import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createStore } from '../lib/store.mjs';
import { createService, inspectPayPalOrder } from '../lib/service.mjs';
import { createPayPal, PayPalError, sandboxApprovalUrl } from '../lib/paypal.mjs';

// All providers and evidence in this file are TEST-ONLY MOCKS. No PayPal/Ollama
// connection is made. These tests cannot establish a real sandbox payment.
const SESSION = 'test-browser-session-0001';
const OTHER = 'test-browser-session-0002';
const item = { id: 'synthetic-orbit', title: 'Orbit Box', subtitle: 'Synthetic test fixture', description: 'Original edition. Includes its original box and manual.', priceCents: 4200, currency: 'USD', version: 1, art: 'orbit' };
const evidenceMock = async ({ description, requirements }) => {
  const sourceDigest = createHash('sha256').update(description).digest('hex');
  const spanId = `test-only-${sourceDigest.slice(0, 12)}-0`;
  return { kind: 'quote-suggestions', evidenceVersion: 'TEST-ONLY-quote-suggestions', sourceDigest,
    sourceSpans: [{ id: spanId, start: 0, end: description.length, text: description, eligible: true }],
    results: requirements.map((requirement, index) => ({ requirement,
      suggestions: [{ spanId, quote: description }],
      questions: [{ id: `test-only-question-${index + 1}`, text: 'Does this seller passage address your requirement?' }],
      validation: 'valid', reason: 'Test-only quote suggestion fixture; the buyer decides what it means.' })),
    notices: [], model: 'test-only-mock', durationMs: 0 };
};

function providerMock() {
  let sequence = 0;
  const records = new Map();
  const counts = { create: 0, get: 0, capture: 0 };
  const requestIds = { create: [], capture: [] };
  const mock = {
    configured: true, mode: 'sandbox', testOnlyMock: true, records, counts, requestIds,
    createHook: null, getHook: null, captureHook: null,
    async createOrder(order, requestId) {
      counts.create++; requestIds.create.push(requestId);
      if (mock.createHook) return mock.createHook(order, requestId);
      let data = [...records.values()].find((record) => record.requestId === requestId)?.data;
      if (!data) {
        data = { id: `MOCKORDER${++sequence}`, status: 'CREATED', intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, custom_id: order.id, amount: { currency_code: order.currency, value: (order.amountCents / 100).toFixed(2) } }] };
        data.links = [{ rel: 'approve', href: `https://www.sandbox.paypal.com/checkoutnow?token=${data.id}` }];
        records.set(data.id, { requestId, data });
      }
      return structuredClone(data);
    },
    async getOrder(id) {
      counts.get++;
      if (mock.getHook) return mock.getHook(id);
      return structuredClone(records.get(id).data);
    },
    async captureOrder(id, requestId) {
      counts.capture++; requestIds.capture.push(requestId);
      if (mock.captureHook) return mock.captureHook(id, requestId);
      mock.setCapture(id, 'COMPLETED');
      return structuredClone(records.get(id).data);
    },
    approve(id) { records.get(id).data.status = 'APPROVED'; },
    setCapture(id, status, changes = {}) {
      const data = records.get(id).data;
      data.status = 'COMPLETED';
      data.purchase_units[0].payments = { captures: [{ id: `MOCKCAPTURE${sequence}`, status, final_capture: true, amount: structuredClone(data.purchase_units[0].amount), ...changes }] };
    },
  };
  return mock;
}
function fixture(options = {}) {
  const paypal = options.paypal ?? providerMock();
  const store = createStore(options.path ?? ':memory:', [item]);
  const service = createService({ store, paypal, evidence: options.evidence ?? evidenceMock, origin: 'http://127.0.0.1:4310' });
  return { store, service, paypal };
}
async function reviewed(service, sessionId = SESSION) {
  const review = await service.createReview(sessionId, { listingId: item.id, requirements: ['Original edition'] });
  await service.confirmReview(sessionId, review.id, { acknowledged: true }); return review;
}
async function ordered(context) {
  const review = await reviewed(context.service);
  const order = await context.service.createOrder(SESSION, { reviewId: review.id });
  return { review, order };
}
const rejectsCode = (operation, code) => assert.rejects(operation, (error) => error.code === code);

function isStrictDescendant(directory, root, paths = path) {
  const relative = paths.relative(paths.resolve(root), paths.resolve(directory));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${paths.sep}`) && !paths.isAbsolute(relative);
}

for (const [platform, paths, root] of [
  ['POSIX', path.posix, '/tmp'],
  ['Windows', path.win32, 'C:\\Temp'],
]) {
  test(`temporary directory containment rejects root, siblings and outside paths on ${platform}`, () => {
    assert.equal(isStrictDescendant(paths.join(root, 'second-look-payment-test-123'), root, paths), true);
    assert.equal(isStrictDescendant(paths.join(root, 'nested', 'child'), root, paths), true);
    assert.equal(isStrictDescendant(paths.join(root, '..notes'), root, paths), true);
    assert.equal(isStrictDescendant(root, root, paths), false);
    assert.equal(isStrictDescendant(paths.join(root, 'child', '..'), root, paths), false);
    assert.equal(isStrictDescendant(`${root}-sibling`, root, paths), false);
    assert.equal(isStrictDescendant(paths.join(root, '..', 'outside'), root, paths), false);
    assert.equal(isStrictDescendant(paths.dirname(root), root, paths), false);
    if (platform === 'Windows') assert.equal(isStrictDescendant('D:\\Temp\\child', root, paths), false);
  });
}

test('TEST-ONLY MOCK: disabled adapter prevents checkout and makes no provider calls', async (t) => {
  const context = fixture({ paypal: createPayPal({ origin: 'http://127.0.0.1:4310', fetchImpl: () => { throw new Error('No network expected'); } }) }); t.after(() => context.store.close());
  const review = await reviewed(context.service);
  await rejectsCode(context.service.createOrder(SESSION, { reviewId: review.id }), 'PAYPAL_DISABLED');
  assert.equal(context.store.orderForReview(review.id), null);
});

test('TEST-ONLY MOCK: explicit review required, suggestions/questions preserved, client price rejected', async (t) => {
  const { service, store } = fixture(); t.after(() => store.close());
  const review = await service.createReview(SESSION, { listingId: item.id, requirements: ['Original edition'] });
  assert.equal(review.analysis.kind, 'quote-suggestions');
  assert.equal(Object.hasOwn(review.analysis.results[0], 'status'), false);
  assert.equal(review.analysis.results[0].suggestions[0].quote, item.description);
  assert.equal(review.analysis.results[0].questions[0].id, 'test-only-question-1');
  await rejectsCode(service.createOrder(SESSION, { reviewId: review.id }), 'REVIEW_REQUIRED');
  await rejectsCode(service.confirmReview(SESSION, review.id, { acknowledged: false }), 'REVIEW_REQUIRED');
  await rejectsCode(service.createOrder(SESSION, { reviewId: review.id, priceCents: 1 }), 'INVALID_INPUT');
  await rejectsCode(service.createReview(SESSION, { listingId: item.id, requirements: [], currency: 'USD' }), 'INVALID_INPUT');
});

test('TEST-ONLY MOCK: session ownership hides foreign reviews and receipts', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { review, order } = await ordered(context);
  assert.throws(() => context.service.getReview(OTHER, review.id), (error) => error.status === 404);
  assert.throws(() => context.service.getOrder(OTHER, order.id), (error) => error.status === 404);
  await rejectsCode(context.service.captureOrder(OTHER, order.id), 'NOT_FOUND');
  assert.equal('sessionId' in order, false); assert.equal('createRequestId' in order, false);
});

test('TEST-ONLY MOCK: quote-suggestion analyses remain opaque snapshots and public edits cannot mutate saved source IDs/questions', async (t) => {
  const context = fixture(); t.after(() => context.store.close());
  const review = await reviewed(context.service);
  const expected = await evidenceMock({ description: item.description, requirements: review.requirements });
  assert.deepEqual(review.analysis, expected, 'Creation preserves every supplied suggestion metadata field');
  const order = await context.service.createOrder(SESSION, { reviewId: review.id });
  assert.deepEqual(order.analysis, expected);
  assert.equal(Object.hasOwn(order.analysis.results[0], 'status'), false);
  assert.equal(order.amountCents, item.priceCents);
  review.analysis.sourceSpans[0].id = 'tampered-public-span';
  review.analysis.results[0].suggestions[0].quote = 'tampered-public-quote';
  order.analysis.results[0].suggestions[0].spanId = 'tampered-public-span';
  order.analysis.results[0].questions[0].text = 'tampered-public-question';
  order.analysis.evidenceVersion = 'tampered-public-version';
  assert.deepEqual(context.service.getReview(SESSION, review.id).analysis, expected);
  assert.deepEqual(context.service.getOrder(SESSION, order.id).analysis, expected);
  context.paypal.approve(order.paypalOrderId);
  const receipt = await context.service.captureOrder(SESSION, order.id);
  assert.equal(receipt.status, 'completed'); assert.equal(receipt.captureStatus, 'COMPLETED');
  assert.deepEqual(receipt.analysis, expected, 'Capture does not reinterpret or relabel quote suggestions');
  assert.equal(context.paypal.counts.capture, 1);
});

test('TEST-ONLY MOCK: concurrent create clicks share one durable order and request ID', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const review = await reviewed(context.service);
  const orders = await Promise.all(Array.from({ length: 8 }, () => context.service.createOrder(SESSION, { reviewId: review.id })));
  assert.equal(new Set(orders.map((order) => order.id)).size, 1); assert.equal(context.paypal.counts.create, 1);
  const saved = context.store.orderForReview(review.id);
  assert.equal(saved.createRequestId, context.paypal.requestIds.create[0]);
  assert.equal(saved.amountCents, item.priceCents);
  assert.equal((await context.service.createOrder(SESSION, { reviewId: review.id })).id, orders[0].id);
});

test('TEST-ONLY MOCK: callback-style capture before server approval never charges', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context);
  const result = await context.service.captureOrder(SESSION, order.id);
  assert.equal(result.status, 'awaiting_approval'); assert.equal(result.captureId, null); assert.equal(context.paypal.counts.capture, 0);
});

test('TEST-ONLY MOCK: approved capture verified once; replay, cancel, and back preserve receipt', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  const results = await Promise.all(Array.from({ length: 8 }, () => context.service.captureOrder(SESSION, order.id)));
  assert.ok(results.every((result) => result.status === 'completed' && result.captureStatus === 'COMPLETED'));
  assert.equal(context.paypal.counts.capture, 1);
  assert.equal(context.store.order(order.id).captureRequestId, context.paypal.requestIds.capture[0]);
  assert.equal((await context.service.cancelOrder(SESSION, order.id)).status, 'completed');
  assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'completed');
  assert.equal(context.service.getOrder(SESSION, order.id).snapshot.description, item.description);
});

test('TEST-ONLY MOCK: merchant description/price change invalidates confirmed review and existing approval', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { review, order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  const changed = await context.service.editListing(SESSION, item.id, { description: 'Replacement box. Manual missing.', priceCents: 7300, expectedVersion: 1 });
  assert.equal(changed.version, 2); assert.equal(context.service.getReview(SESSION, review.id).stale, true);
  assert.equal(context.service.getOrder(SESSION, order.id).status, 'stale'); assert.equal(context.service.getOrder(SESSION, order.id).approvalUrl, null);
  await rejectsCode(context.service.confirmReview(SESSION, review.id, { acknowledged: true }), 'STALE_REVIEW');
  await rejectsCode(context.service.captureOrder(SESSION, order.id), 'STALE_REVIEW'); assert.equal(context.paypal.counts.capture, 0);
  const freshReview = await reviewed(context.service);
  const newOrder = await context.service.createOrder(SESSION, { reviewId: freshReview.id });
  assert.equal(newOrder.amountCents, 7300); assert.equal(newOrder.snapshot.version, 2); assert.notEqual(newOrder.id, order.id);
  assert.equal(context.service.getOrder(SESSION, order.id).amountCents, 4200);
});

test('TEST-ONLY MOCK: edit cannot race a provider capture; cancellation cannot hide it', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  let release; let entered;
  const inCapture = new Promise((done) => { entered = done; }); const gate = new Promise((done) => { release = done; });
  context.paypal.captureHook = async (id) => { entered(); await gate; context.paypal.setCapture(id, 'COMPLETED'); return structuredClone(context.paypal.records.get(id).data); };
  const capture = context.service.captureOrder(SESSION, order.id); await inCapture;
  await rejectsCode(context.service.editListing(SESSION, item.id, { description: 'Changed.', priceCents: 8400, expectedVersion: 1 }), 'LISTING_BUSY');
  assert.equal((await context.service.cancelOrder(SESSION, order.id)).status, 'capture_in_progress');
  release(); assert.equal((await capture).status, 'completed'); assert.equal(context.service.getListing(item.id).version, 1);
});

test('TEST-ONLY MOCK: cancellation before capture is persistent and capture does not reopen it', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  assert.equal((await context.service.cancelOrder(SESSION, order.id)).status, 'cancelled');
  assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'cancelled'); assert.equal(context.paypal.counts.capture, 0);
  assert.equal((await context.service.reconcileOrder(SESSION, order.id)).status, 'cancelled');
});

for (const captureStatus of ['PENDING', 'DENIED', 'DECLINED', 'FAILED']) {
  test(`TEST-ONLY MOCK: ${captureStatus} capture is never represented as paid`, async (t) => {
    const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
    context.paypal.captureHook = async (id) => { context.paypal.setCapture(id, captureStatus); return structuredClone(context.paypal.records.get(id).data); };
    const result = await context.service.captureOrder(SESSION, order.id);
    assert.equal(result.status, captureStatus === 'PENDING' ? 'pending' : 'failed'); assert.equal(result.captureStatus, captureStatus);
    assert.equal((await context.service.cancelOrder(SESSION, order.id)).status, result.status);
  });
}

test('TEST-ONLY MOCK: timeout after actual mock capture reconciles to provider truth', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  context.paypal.captureHook = async (id) => { context.paypal.setCapture(id, 'COMPLETED'); throw new PayPalError('TIMEOUT', { ambiguous: true }); };
  assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'completed'); assert.equal(context.paypal.counts.capture, 1);
});

test('TEST-ONLY MOCK: ambiguous capture stays visible, read-only replay and new review cannot duplicate charge', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  context.paypal.captureHook = async () => { throw new PayPalError('TIMEOUT', { ambiguous: true }); };
  const result = await context.service.captureOrder(SESSION, order.id); assert.equal(result.status, 'ambiguous');
  assert.equal((await context.service.cancelOrder(SESSION, order.id)).status, 'ambiguous');
  assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'ambiguous'); assert.equal(context.paypal.counts.capture, 1);
  await context.service.editListing(SESSION, item.id, { description: 'Changed price and description.', priceCents: 6000, expectedVersion: 1 });
  const newReview = await reviewed(context.service);
  await rejectsCode(context.service.createOrder(SESSION, { reviewId: newReview.id }), 'PAYMENT_UNRESOLVED');
  context.paypal.setCapture(order.paypalOrderId, 'COMPLETED');
  assert.equal((await context.service.reconcileOrder(SESSION, order.id)).status, 'completed');
});

test('TEST-ONLY MOCK: pending capture can later settle, and provider refresh failures preserve verified truth', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  context.paypal.captureHook = async (id) => { context.paypal.setCapture(id, 'PENDING'); return structuredClone(context.paypal.records.get(id).data); };
  assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'pending');
  context.paypal.setCapture(order.paypalOrderId, 'COMPLETED');
  assert.equal((await context.service.reconcileOrder(SESSION, order.id)).status, 'completed');
  context.paypal.getHook = async () => { throw new Error('Mock connection lost'); };
  const result = await context.service.reconcileOrder(SESSION, order.id); assert.equal(result.status, 'completed'); assert.equal(result.verificationIssue, true);
});

test('TEST-ONLY MOCK: amount/currency/reference mismatch before capture fails closed', async (t) => {
  for (const field of ['amount', 'currency', 'reference']) {
    const context = fixture(); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
    const unit = context.paypal.records.get(order.paypalOrderId).data.purchase_units[0];
    if (field === 'amount') unit.amount.value = '0.01';
    if (field === 'currency') unit.amount.currency_code = 'EUR';
    if (field === 'reference') unit.reference_id = 'ANOTHERORDER';
    assert.equal((await context.service.captureOrder(SESSION, order.id)).status, 'ambiguous'); assert.equal(context.paypal.counts.capture, 0);
    context.store.close();
  }
});

test('TEST-ONLY MOCK: singleton exact final capture schema rejects duplicate, partial, unsupported and wrong amounts', async () => {
  const context = fixture(); const { order } = await ordered(context); context.paypal.setCapture(order.paypalOrderId, 'COMPLETED');
  const full = context.paypal.records.get(order.paypalOrderId).data;
  assert.equal(inspectPayPalOrder(order, full).status, 'completed');
  for (const mutate of [
    (data) => data.purchase_units[0].payments.captures.push(structuredClone(data.purchase_units[0].payments.captures[0])),
    (data) => { data.purchase_units[0].payments.captures[0].amount.value = '41.99'; },
    (data) => { data.purchase_units[0].payments.captures[0].final_capture = false; },
    (data) => { data.purchase_units[0].payments.captures[0].status = 'NEW_UNSUPPORTED_STATUS'; },
    (data) => { data.purchase_units[0].payments = {}; },
    (data) => { data.intent = 'AUTHORIZE'; },
    (data) => { data.purchase_units.push(structuredClone(data.purchase_units[0])); },
  ]) { const data = structuredClone(full); mutate(data); assert.equal(inspectPayPalOrder(order, data), null); }
  // The official capture representation can omit unit.amount; the single final
  // capture amount still has to match the saved server-owned expected amount.
  const captureRepresentation = structuredClone(full); delete captureRepresentation.purchase_units[0].amount;
  assert.equal(inspectPayPalOrder(order, captureRepresentation).status, 'completed'); context.store.close();
});

test('TEST-ONLY MOCK: malformed capture response cannot mark completed', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const { order } = await ordered(context); context.paypal.approve(order.paypalOrderId);
  context.paypal.captureHook = async () => ({ id: order.paypalOrderId, status: 'COMPLETED' });
  const result = await context.service.captureOrder(SESSION, order.id); assert.equal(result.status, 'ambiguous'); assert.equal(result.captureId, null); assert.equal(result.verificationIssue, true);
});

test('TEST-ONLY MOCK: malformed provider units and approval links produce visible uncertainty', async () => {
  for (const mutate of [
    (data) => { data.purchase_units = [null]; },
    (data) => { data.purchase_units[0].payments = 'unexpected'; },
    (data) => { data.links = {}; },
    (data) => { data.links = [null, { rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=MOCKORDER1' }]; },
  ]) {
    const context = fixture(); const review = await reviewed(context.service);
    context.paypal.createHook = async (order) => {
      const data = { id: 'MOCKORDER1', intent: 'CAPTURE', status: 'CREATED', purchase_units: [{ reference_id: order.id, amount: { currency_code: 'USD', value: '42.00' } }], links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCKORDER1' }] };
      mutate(data); return data;
    };
    const result = await context.service.createOrder(SESSION, { reviewId: review.id });
    assert.equal(result.status, 'ambiguous'); assert.equal(result.verificationIssue, true); assert.equal(result.approvalUrl, null);
    assert.equal(context.service.getOrder(SESSION, result.id).status, 'ambiguous'); context.store.close();
  }
});

test('TEST-ONLY MOCK: official minimal payer-action create response is verified through server GET before approval', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const review = await reviewed(context.service);
  context.paypal.createHook = async (order, requestId) => {
    const data = { id: 'MOCKORDER1', status: 'PAYER_ACTION_REQUIRED', intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, amount: { currency_code: 'USD', value: '42.00' } }] };
    context.paypal.records.set(data.id, { requestId, data });
    return { id: data.id, status: data.status, payment_source: { paypal: {} }, links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=MOCKORDER1' }] };
  };
  const order = await context.service.createOrder(SESSION, { reviewId: review.id });
  assert.equal(order.status, 'awaiting_approval'); assert.equal(context.paypal.counts.get, 1); assert.match(order.approvalUrl, /^https:\/\/www\.sandbox\.paypal\.com\//);
});

test('TEST-ONLY MOCK: create timeout retry reuses the persisted UUID', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const review = await reviewed(context.service);
  context.paypal.createHook = async () => { throw new PayPalError('TIMEOUT', { ambiguous: true }); };
  const uncertain = await context.service.createOrder(SESSION, { reviewId: review.id }); assert.equal(uncertain.status, 'ambiguous');
  const savedRequest = context.store.order(uncertain.id).createRequestId;
  context.paypal.createHook = null;
  const retry = await context.service.createOrder(SESSION, { reviewId: review.id });
  assert.equal(retry.id, uncertain.id); assert.equal(retry.status, 'awaiting_approval'); assert.deepEqual(context.paypal.requestIds.create, [savedRequest, savedRequest]);
});

test('TEST-ONLY MOCK: duplicate provider order and capture IDs are visibly rejected', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const first = await ordered(context); context.paypal.approve(first.order.paypalOrderId);
  await context.service.captureOrder(SESSION, first.order.id);
  const review = await reviewed(context.service);
  context.paypal.createHook = async (order) => { const data = structuredClone(context.paypal.records.get(first.order.paypalOrderId).data); data.purchase_units[0].reference_id = order.id; data.purchase_units[0].custom_id = order.id; return data; };
  const duplicateOrder = await context.service.createOrder(SESSION, { reviewId: review.id });
  assert.equal(duplicateOrder.status, 'ambiguous'); assert.equal(duplicateOrder.paypalOrderId, null);
  context.paypal.createHook = null; const second = await ordered(context); context.paypal.approve(second.order.paypalOrderId);
  context.paypal.captureHook = async (id) => { context.paypal.setCapture(id, 'COMPLETED', { id: context.service.getOrder(SESSION, first.order.id).captureId }); return structuredClone(context.paypal.records.get(id).data); };
  const duplicateCapture = await context.service.captureOrder(SESSION, second.order.id);
  assert.equal(duplicateCapture.status, 'ambiguous'); assert.equal(duplicateCapture.captureId, null); assert.equal(context.service.getOrder(SESSION, first.order.id).status, 'completed');
});

test('TEST-ONLY MOCK: SQLite preserves quote IDs/questions and receipt snapshots through edit/restart; interrupted capture recovers unknown', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'second-look-payment-test-'));
  assert.ok(isStrictDescendant(directory, tmpdir()));
  try {
    const path = join(directory, 'shop.sqlite'); const paypal = providerMock(); const first = fixture({ path, paypal }); const { review, order } = await ordered(first); paypal.approve(order.paypalOrderId);
    const originalAnalysis = structuredClone(review.analysis);
    assert.equal(originalAnalysis.kind, 'quote-suggestions');
    assert.equal(Object.hasOwn(originalAnalysis.results[0], 'status'), false);
    assert.equal(originalAnalysis.sourceDigest, createHash('sha256').update(item.description).digest('hex'));
    assert.equal(originalAnalysis.results[0].suggestions[0].spanId, originalAnalysis.sourceSpans[0].id);
    assert.equal(originalAnalysis.results[0].suggestions[0].quote, originalAnalysis.sourceSpans[0].text);
    await first.service.captureOrder(SESSION, order.id);
    await first.service.editListing(SESSION, item.id, { description: 'Merchant changed it later.', priceCents: 6500, expectedVersion: 1 });
    first.store.close(); const second = fixture({ path, paypal });
    assert.equal(second.service.getOrder(SESSION, order.id).status, 'completed'); assert.equal(second.service.getOrder(SESSION, order.id).amountCents, 4200);
    assert.equal(second.service.getReview(SESSION, review.id).stale, true); assert.equal(second.service.getListing(item.id).priceCents, 6500);
    assert.deepEqual(second.service.getReview(SESSION, review.id).analysis, originalAnalysis);
    assert.deepEqual(second.service.getOrder(SESSION, order.id).analysis, originalAnalysis);
    assert.equal(second.service.getOrder(SESSION, order.id).snapshot.description, item.description);
    const next = await ordered(second); const raw = second.store.order(next.order.id);
    assert.equal(next.review.analysis.sourceSpans[0].text, 'Merchant changed it later.');
    assert.notEqual(next.review.analysis.sourceDigest, originalAnalysis.sourceDigest);
    assert.notEqual(next.review.analysis.sourceSpans[0].id, originalAnalysis.sourceSpans[0].id);
    assert.deepEqual(next.order.analysis, next.review.analysis);
    assert.equal(next.order.amountCents, 6500);
    const nextAnalysis = structuredClone(next.review.analysis);
    Object.assign(raw, { status: 'capture_in_progress', captureRequestId: randomUUID(), captureAttemptedAt: new Date().toISOString() }); second.store.saveOrder(raw); second.store.close();
    const third = fixture({ path, paypal }); assert.equal(third.service.getOrder(SESSION, next.order.id).status, 'ambiguous');
    assert.deepEqual(third.service.getOrder(SESSION, order.id).analysis, originalAnalysis);
    assert.deepEqual(third.service.getOrder(SESSION, next.order.id).analysis, nextAnalysis);
    assert.deepEqual(third.service.getReview(SESSION, next.review.id).analysis, nextAnalysis);
    assert.equal((await third.service.cancelOrder(SESSION, next.order.id)).status, 'ambiguous');
    await third.service.captureOrder(SESSION, next.order.id); assert.equal(paypal.counts.capture, 1); third.store.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('TEST-ONLY MOCK: persisted listing lease blocks another operation', async (t) => {
  const context = fixture(); t.after(() => context.store.close()); const token = randomUUID();
  assert.equal(context.store.acquireLease(item.id, token), true);
  await rejectsCode(context.service.editListing(SESSION, item.id, { description: 'New description.', priceCents: 5000, expectedVersion: 1 }), 'LISTING_BUSY');
  context.store.releaseLease(item.id, token);
});

test('TEST-ONLY MOCK: unavailable quote suggestions preserve full seller source without verdicts; edits during analysis become stale', async (t) => {
  const context = fixture({ evidence: async () => { throw new Error('Mock model unavailable'); } }); t.after(() => context.store.close());
  const review = await context.service.createReview(SESSION, { listingId: item.id, requirements: ['Original box'] });
  assert.equal(review.analysis.kind, 'quote-suggestions');
  assert.equal(review.analysis.results[0].validation, 'unavailable');
  assert.equal(Object.hasOwn(review.analysis.results[0], 'status'), false);
  assert.equal(Object.hasOwn(review.analysis, 'evidenceVersion'), false);
  assert.deepEqual(review.analysis.results[0].suggestions, []);
  assert.deepEqual(review.analysis.results[0].questions, []);
  assert.deepEqual(review.analysis.sourceSpans, []); assert.equal(review.analysis.sourceDigest, null);
  assert.equal(review.snapshot.description, item.description);
  let finish; let entered; const start = new Promise((done) => { entered = done; });
  const service = createService({ store: context.store, paypal: context.paypal, origin: 'http://127.0.0.1:4310', evidence: async (input) => { entered(); await new Promise((done) => { finish = done; }); return evidenceMock(input); } });
  const pendingReview = service.createReview(SESSION, { listingId: item.id, requirements: ['Original box'] }); await start;
  await service.editListing(SESSION, item.id, { description: 'New merchant description.', priceCents: 4200, expectedVersion: 1 }); finish();
  assert.equal((await pendingReview).stale, true);
});

test('TEST-ONLY MOCK transport: sandbox-only adapter sends server price and durable idempotency headers', async () => {
  const requests = [];
  const adapter = createPayPal({ clientId: 'TEST_ONLY_ID', clientSecret: 'TEST_ONLY_SECRET', origin: 'http://127.0.0.1:4310', fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return Response.json(url.endsWith('/v1/oauth2/token') ? { access_token: 'TEST_ONLY_TOKEN', token_type: 'Bearer', expires_in: 3600 } : { id: 'MOCKORDER1', status: 'CREATED' });
  } });
  const requestId = randomUUID(); const order = { id: randomUUID(), amountCents: 4200, currency: 'USD' };
  await adapter.createOrder(order, requestId); await adapter.getOrder('MOCKORDER1'); await adapter.captureOrder('MOCKORDER1', requestId);
  assert.ok(requests.every(({ url, init }) => url.startsWith('https://api-m.sandbox.paypal.com/') && init.redirect === 'error' && init.signal));
  const create = requests[1]; const body = JSON.parse(create.init.body);
  assert.equal(create.init.headers['PayPal-Request-Id'], requestId); assert.equal(body.purchase_units[0].amount.value, '42.00'); assert.equal(body.purchase_units[0].reference_id, order.id);
  assert.equal(body.payment_source.paypal.experience_context.shipping_preference, 'NO_SHIPPING');
  assert.equal(requests[3].init.headers['PayPal-Request-Id'], requestId);
  assert.equal(body.payment_source.paypal.experience_context.return_url, `http://127.0.0.1:4310/?checkout=return&order=${order.id}`);
});

test('TEST-ONLY MOCK transport: unsafe redirects/config, malformed body, oversized response and timeout reject safely', async () => {
  assert.throws(() => createPayPal({ origin: 'https://shop.example' }));
  assert.equal(sandboxApprovalUrl('https://www.paypal.com/checkoutnow?token=MOCKORDER1', 'MOCKORDER1'), null);
  assert.equal(sandboxApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=OTHER', 'MOCKORDER1'), null);
  assert.equal(sandboxApprovalUrl('https://evil.example/checkoutnow?token=MOCKORDER1', 'MOCKORDER1'), null);
  assert.equal(sandboxApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=MOCKORDER1', 'MOCKORDER1'), 'https://www.sandbox.paypal.com/checkoutnow?token=MOCKORDER1');
  for (const badResponse of ['not json', 'x'.repeat(128_001)]) {
    const adapter = createPayPal({ clientId: 'TEST_ONLY_ID', clientSecret: 'TEST_ONLY_SECRET', origin: 'http://127.0.0.1:4310', fetchImpl: async (url) => url.endsWith('/v1/oauth2/token') ? Response.json({ access_token: 'MOCK', token_type: 'Bearer', expires_in: 3600 }) : new Response(badResponse) });
    await assert.rejects(adapter.createOrder({ id: randomUUID(), amountCents: 4200, currency: 'USD' }, randomUUID()), (error) => error.ambiguous === true && !error.message.includes('TEST_ONLY_SECRET'));
  }
  const adapter = createPayPal({ clientId: 'TEST_ONLY_ID', clientSecret: 'TEST_ONLY_SECRET', origin: 'http://127.0.0.1:4310', timeoutMs: 5, fetchImpl: async (url, init) => url.endsWith('/v1/oauth2/token') ? Response.json({ access_token: 'MOCK', token_type: 'Bearer', expires_in: 3600 }) : new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason)); setTimeout(resolve, 50); }) });
  await assert.rejects(adapter.captureOrder('MOCKORDER1', randomUUID()), (error) => error.ambiguous === true);
});
