import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createStore } from '../lib/store.mjs';
import { createService } from '../lib/service.mjs';
import { createPayPal } from '../lib/paypal.mjs';
import { riverlightMoneyScenario as scenario, totalFixtureCents, fixtureBudgetVerdict } from './fixtures/independent-riverlight-money.mjs';

// EXPOSED PARENT INDEPENDENT HOLDOUT SCENARIO. Every provider response below is
// a TEST-ONLY MOCK. No network, PayPal operation, or model invocation is used.
const SESSION = 'test-only-riverlight-session-001';
const evidenceMock = async ({ description, requirements }) => ({
  kind: 'quote-suggestions', evidenceVersion: 'TEST-ONLY-quote-suggestions',
  sourceDigest: createHash('sha256').update(description).digest('hex'),
  sourceSpans: [{ id: 'test-only-riverlight-source-0', start: 0, end: description.length, text: description, eligible: true }],
  notices: [], model: 'TEST-ONLY-MOCK-NO-MODEL-INVOKED', durationMs: 0,
  results: requirements.map((requirement) => ({ requirement, suggestions: [], questions: [], validation: 'valid',
    reason: 'Test-only suggestion placeholder. Money arithmetic is separately verified from trusted fixture cents; seller statements remain unverified.' })),
});
function testOnlyProviderMock() {
  const records = new Map();
  const createAmounts = [];
  let captures = 0;
  return {
    configured: true, testOnlyMock: true, createAmounts,
    get captureCalls() { return captures; },
    async createOrder(order) {
      const id = `RIVERLIGHTMOCK${records.size + 1}`;
      const data = { id, intent: 'CAPTURE', status: 'CREATED', purchase_units: [{ reference_id: order.id,
        amount: { currency_code: order.currency, value: (order.amountCents / 100).toFixed(2) } }],
      links: [{ rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` }] };
      createAmounts.push(order.amountCents); records.set(id, data); return structuredClone(data);
    },
    async getOrder(id) { return structuredClone(records.get(id)); },
    approve(id) { records.get(id).status = 'APPROVED'; },
    async captureOrder(id) {
      captures++;
      const data = records.get(id);
      assert.equal(data.status, 'APPROVED', 'TEST-ONLY MOCK requires separate approval for this provider order');
      data.status = 'COMPLETED';
      data.purchase_units[0].payments = { captures: [{ id: `RIVERLIGHTCAPTURE${captures}`, status: 'COMPLETED', final_capture: true,
        amount: structuredClone(data.purchase_units[0].amount) }] };
      return structuredClone(data);
    },
  };
}
function openService(path, paypal) {
  const store = createStore(path, [scenario.original]);
  return { store, service: createService({ store, paypal, evidence: evidenceMock, origin: 'http://127.0.0.1:4310' }) };
}
const errorCode = (code) => (error) => error.code === code;

test('EXPOSED independent case 11: trusted cents yield $38 within $40, then $43 above $40', () => {
  assert.equal(scenario.provenance.exposedBeforeTestAuthoring, true);
  assert.equal(scenario.provenance.modelAccuracyMeasurement, false);
  assert.equal(scenario.buyerOriginal, 'An original Riverlight badge for no more than $40 total, including delivery.');
  assert.equal(scenario.original.description, 'Original Riverlight badge. Item $34; delivery $4; no additional charges.');
  assert.equal(scenario.updated.description, 'Original Riverlight badge. Item $39; delivery $4; no additional charges.');
  assert.equal(scenario.requirementMapping.scope, 'isolated budget condition');
  assert.equal(totalFixtureCents(scenario.originalMoney), 3800);
  assert.equal(totalFixtureCents(scenario.updatedMoney), 4300);
  assert.equal(fixtureBudgetVerdict(scenario.original.priceCents, scenario.maximumCents), 'match');
  assert.equal(fixtureBudgetVerdict(scenario.updated.priceCents, scenario.maximumCents), 'contradiction');
  assert.equal(fixtureBudgetVerdict(4000, scenario.maximumCents), 'match', 'maximum is inclusive');
});

test('EXPOSED independent case 11: monetary calculation refuses text, missing charges, fractional or overflowing cents', () => {
  for (const invalid of [
    scenario.original.description,
    { itemCents: 3400, deliveryCents: 400 },
    { itemCents: '3400', deliveryCents: 400, additionalChargesCents: 0 },
    { itemCents: 3400.5, deliveryCents: 400, additionalChargesCents: 0 },
    { itemCents: 3400, deliveryCents: -400, additionalChargesCents: 0 },
    { itemCents: 3400, deliveryCents: 400, additionalChargesCents: 0, browserTotal: 1 },
  ]) assert.throws(() => totalFixtureCents(invalid), TypeError);
  assert.throws(() => totalFixtureCents({ itemCents: Number.MAX_SAFE_INTEGER, deliveryCents: 1, additionalChargesCents: 0 }), RangeError);
});

test('EXPOSED independent case 11, TEST-ONLY MOCK: persisted price edit invalidates old review/approval and requires new confirmation/approval', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'second-look-riverlight-test-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
  const path = join(directory, 'riverlight.sqlite');
  const paypal = testOnlyProviderMock();
  let context = openService(path, paypal);
  try {
    const review = await context.service.createReview(SESSION, { listingId: scenario.original.id, requirements: [scenario.requirement] });
    assert.equal(review.snapshot.priceCents, 3800);
    assert.equal(review.analysis.kind, 'quote-suggestions');
    assert.equal(Object.hasOwn(review.analysis.results[0], 'status'), false, 'Arithmetic assertions do not manufacture an LLM verdict');
    assert.deepEqual(review.analysis.results[0].suggestions, []);
    await assert.rejects(context.service.createOrder(SESSION, { reviewId: review.id }), errorCode('REVIEW_REQUIRED'));
    await context.service.confirmReview(SESSION, review.id, { acknowledged: true });
    const oldOrder = await context.service.createOrder(SESSION, { reviewId: review.id });
    paypal.approve(oldOrder.paypalOrderId); // test-only old version buyer approval
    assert.equal(oldOrder.amountCents, 3800);
    context.store.close(); context = openService(path, paypal);
    assert.equal(context.service.getReview(SESSION, review.id).snapshot.priceCents, 3800);
    assert.ok(context.service.getReview(SESSION, review.id).confirmedAt);
    await context.service.editListing(SESSION, scenario.original.id, {
      description: scenario.updated.description, priceCents: scenario.updated.priceCents, expectedVersion: 1,
    });
    context.store.close(); context = openService(path, paypal);
    const current = context.service.getListing(scenario.original.id);
    assert.equal(current.priceCents, 4300); assert.equal(current.version, 2);
    assert.equal(fixtureBudgetVerdict(current.priceCents, scenario.maximumCents), 'contradiction');
    const staleReview = context.service.getReview(SESSION, review.id);
    assert.equal(staleReview.stale, true); assert.equal(staleReview.snapshot.priceCents, 3800);
    const staleOrder = context.service.getOrder(SESSION, oldOrder.id);
    assert.equal(staleOrder.status, 'stale'); assert.equal(staleOrder.stale, true);
    assert.equal(staleOrder.amountCents, 3800); assert.equal(staleOrder.approvalUrl, null);
    await assert.rejects(context.service.confirmReview(SESSION, review.id, { acknowledged: true }), errorCode('STALE_REVIEW'));
    await assert.rejects(context.service.createOrder(SESSION, { reviewId: review.id }), errorCode('STALE_REVIEW'));
    await assert.rejects(context.service.captureOrder(SESSION, oldOrder.id), errorCode('STALE_REVIEW'));
    assert.equal(paypal.captureCalls, 0);
    const newReview = await context.service.createReview(SESSION, { listingId: scenario.original.id, requirements: [scenario.requirement] });
    assert.equal(newReview.snapshot.priceCents, 4300); assert.equal(newReview.listingVersion, 2);
    assert.equal(newReview.confirmedAt, null); assert.equal(newReview.stale, false);
    await assert.rejects(context.service.createOrder(SESSION, { reviewId: newReview.id }), errorCode('REVIEW_REQUIRED'));
    await assert.rejects(context.service.createOrder(SESSION, { reviewId: newReview.id, priceCents: 3800 }), errorCode('INVALID_INPUT'));
    await context.service.confirmReview(SESSION, newReview.id, { acknowledged: true });
    const newOrder = await context.service.createOrder(SESSION, { reviewId: newReview.id });
    assert.equal(newOrder.amountCents, 4300); assert.equal(newOrder.snapshot.version, 2);
    assert.notEqual(newOrder.id, oldOrder.id); assert.notEqual(newOrder.paypalOrderId, oldOrder.paypalOrderId);
    const beforeNewApproval = await context.service.captureOrder(SESSION, newOrder.id);
    assert.equal(beforeNewApproval.status, 'awaiting_approval'); assert.equal(beforeNewApproval.providerOrderStatus, 'CREATED');
    assert.equal(paypal.captureCalls, 0, 'Old provider approval does not approve the changed price');
    paypal.approve(newOrder.paypalOrderId); // separate TEST-ONLY MOCK approval
    const receipt = await context.service.captureOrder(SESSION, newOrder.id);
    assert.equal(receipt.status, 'completed'); assert.equal(receipt.captureStatus, 'COMPLETED');
    assert.equal(receipt.amountCents, 4300); assert.equal(receipt.snapshot.priceCents, 4300);
    assert.deepEqual(paypal.createAmounts, [3800, 4300]); assert.equal(paypal.captureCalls, 1);
    context.store.close(); context = openService(path, paypal);
    assert.equal(context.service.getOrder(SESSION, newOrder.id).captureStatus, 'COMPLETED');
    assert.equal(context.service.getOrder(SESSION, oldOrder.id).status, 'stale');
    assert.equal(context.service.getOrder(SESSION, oldOrder.id).captureId, null);
  } finally { context.store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('EXPOSED independent case 11: disabled real adapter makes zero network calls for the server-owned $38 fixture', async (t) => {
  let networkCalls = 0;
  const paypal = createPayPal({ origin: 'http://127.0.0.1:4310', fetchImpl: async () => { networkCalls++; throw new Error('No network is authorized'); } });
  const context = openService(':memory:', paypal); t.after(() => context.store.close());
  const review = await context.service.createReview(SESSION, { listingId: scenario.original.id, requirements: [scenario.requirement] });
  await context.service.confirmReview(SESSION, review.id, { acknowledged: true });
  await assert.rejects(context.service.createOrder(SESSION, { reviewId: review.id }), errorCode('PAYPAL_DISABLED'));
  assert.equal(networkCalls, 0); assert.equal(context.store.orderForReview(review.id), null);
});
