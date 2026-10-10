/** Optional browser QA. Runtime application code has no Playwright dependency. */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { initialListings } from '../lib/catalog.mjs';

const require = createRequire(import.meta.url);
const bundledPlaywright = 'C:/Users/alexa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
catch { playwright = require(bundledPlaywright); }

const out = resolve('artifacts/browser');
await mkdir(out, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  engine: 'Existing Playwright / Chromium, headless interactive automation',
  browserPlugin: 'Absent: Browser skill is not listed',
  cuaFailure: 'MXC launcher cannot locate required Windows platform directory: HRESULT 0x80070003; one attempt, no retry',
  chromiumSandbox: true, checks: [], consoleErrors: [], screenshots: [], screenshotStates: [],
  flow: process.argv.includes('--catalogue-only') ? 'current catalogue only; read-only API GETs, no model or provider requests' : 'catalogue -> listing -> up to three requirements -> seller evidence -> explicit review -> disabled sandbox checkout' + (process.argv.includes('--merchant-edit') ? ' -> controlled merchant edit -> stale review -> fresh review and approval' : ''),
  scope: 'Local synthetic listings only; no payment, account or credential actions',
  mockUI: process.argv.includes('--mock-ui'),
  requests: [],
};
let browser;

async function check(name, fn) {
  try { await fn(); report.checks.push({ name, pass: true }); }
  catch (error) { report.checks.push({ name, pass: false, error: error.message }); throw error; }
}

async function screenshot(page, name) {
  if (report.mockUI && !name.startsWith('MOCK-')) name = `MOCK-${name}`;
  const path = resolve(out, name);
  const state = await page.evaluate(() => {
    const skip = document.querySelector('.skip-link');
    const rect = skip?.getBoundingClientRect();
    return { focus: document.activeElement?.id || document.activeElement?.tagName, scrollY, skipFocused: document.activeElement === skip, skipRect: rect ? { top: rect.top, bottom: rect.bottom } : null };
  });
  // Capture from the top so Chromium does not composite a transformed fixed
  // skip-link into a full-page image at the previous viewport scroll offset.
  if (state.scrollY) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
  report.screenshotStates.push({ file: name, ...state, capturedScrollY: 0 });
  if (state.scrollY) await page.evaluate(y => window.scrollTo(0, y), state.scrollY);
}

/** Browser-only fixtures. These never call the model or payment provider. */
async function installMockUI(page, origin) {
  const listings = new Map(initialListings.map(item => [item.id, structuredClone(item)]));
  const reviews = new Map();
  const orders = new Map();
  let reviewSequence = 0;
  const mockAnalysis = (listing, requirements, invalid = false) => ({
    model: 'MOCK UI FIXTURE — no model call', evidenceVersion: 'MOCK-evidence-v2', durationMs: 0,
    notices: requirements.some(item => item.includes('(MOCK context fixture)')) ? ['MOCK source exclusion notice. A fixture seller passage was excluded; no model call occurred.'] : [],
    results: requirements.map((requirement, index) => ({
      requirement, status: invalid || requirement.includes('(MOCK context fixture)') || index > 1 ? 'unknown' : index === 1 && listing.id === 'atlas-station' ? 'contradiction' : 'match',
      quotes: invalid || index > 1 ? [] : [requirement.includes('(MOCK context fixture)')
        ? 'The original box and original assembly manual are included.'
        : index === 0
        ? listing.description.split('. ')[0] + '.'
        : listing.id === 'atlas-station'
          ? 'One of the eight docking arms is missing, so the contents are incomplete.'
          : 'All four interchangeable antenna pieces are present.'],
      validation: invalid ? 'invalid' : 'valid',
      reason: invalid ? 'MOCK malformed-output fixture; unsupported output remains unknown.' : requirement.includes('(MOCK context fixture)')
        ? 'MOCK valid unknown context fixture; the source sentence alone does not establish the requested condition.' : index > 1
        ? 'MOCK unknown fixture; this requirement is not stated.'
        : 'MOCK visual fixture; not a live evidence evaluation.',
    })),
  });
  await page.route(`${origin}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const body = method === 'POST' ? request.postDataJSON() : {};
    let status = 200;
    let value;
    const fail = (code, message, codeStatus = 400) => { status = codeStatus; value = { error: { code, message } }; };
    if (path === '/api/config') value = {
      brand: { name: 'Second Look · MOCK', merchant: 'MOCK UI FIXTURE · no live inference or payment' },
      csrfToken: 'MOCK-NOT-A-REAL-TOKEN',
      paypal: { configured: false, mode: 'sandbox', message: 'MOCK UI FIXTURE. Credentials are absent; no PayPal action is available.' },
      model: { name: 'MOCK UI FIXTURE' },
    };
    else if (path === '/api/listings') value = { listings: [...listings.values()] };
    else if (path.startsWith('/api/listings/')) {
      const listing = listings.get(path.split('/').at(-1));
      listing ? value = { listing } : fail('not_found', 'MOCK listing unavailable', 404);
    } else if (path === '/api/reviews' && method === 'POST') {
      const listing = listings.get(body.listingId);
      const invalid = body.requirements.some(item => item.includes('invalid fixture'));
      const review = {
        id: `mock-review-${++reviewSequence}`, listingId: listing.id, listingVersion: listing.version,
        snapshot: structuredClone(listing), requirements: body.requirements,
        analysis: mockAnalysis(listing, body.requirements, invalid),
        confirmedAt: null, createdAt: new Date().toISOString(), stale: false,
      };
      reviews.set(review.id, review); value = { review };
      await new Promise(done => setTimeout(done, 300)); // Show the actual UI loading/repeated-click guard.
    } else if (path.startsWith('/api/reviews/')) {
      const segments = path.split('/');
      const review = reviews.get(segments[3]);
      if (!review) fail('not_found', 'MOCK review unavailable', 404);
      else {
        review.stale = listings.get(review.listingId).version !== review.listingVersion;
        if (segments[4] === 'confirm' && method === 'POST') {
          if (review.stale) fail('stale_review', 'MOCK listing changed; review again', 409);
          else { review.confirmedAt = new Date().toISOString(); value = { review }; }
        } else value = { review };
      }
    } else if (path.startsWith('/api/merchant/listings/') && method === 'POST') {
      const listing = listings.get(path.split('/').at(-1));
      if (body.expectedVersion !== listing.version) fail('stale_listing', 'MOCK listing changed', 409);
      else { Object.assign(listing, { description: body.description, priceCents: body.priceCents, version: listing.version + 1 }); value = { listing }; }
    } else if (path.startsWith('/api/orders/mock-')) {
      const segments = path.split('/');
      const id = segments[3];
      if (!orders.has(id)) {
        const snapshot = structuredClone(initialListings[0]);
        const fixtureStatus = id.replace('mock-', '');
        if (!['awaiting_approval', 'pending', 'ambiguous', 'failed', 'cancelled'].includes(fixtureStatus)) {
          await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'mock_order_unavailable', message: 'No completed payment fixture exists.' } }) });
          return;
        }
        orders.set(id, {
          id, reviewId: 'MOCK-REVIEW', listingId: snapshot.id, status: fixtureStatus,
          provider: 'paypal-sandbox', paypalOrderId: 'MOCK-NOT-A-PAYPAL-ORDER',
          captureId: ['pending', 'failed'].includes(fixtureStatus) ? 'MOCK-NOT-A-REAL-CAPTURE' : null,
          providerOrderStatus: fixtureStatus === 'pending' ? 'COMPLETED' : fixtureStatus === 'failed' ? 'APPROVED' : fixtureStatus === 'ambiguous' ? null : 'CREATED',
          captureStatus: fixtureStatus === 'pending' ? 'PENDING' : fixtureStatus === 'failed' ? 'DECLINED' : null,
          verificationIssue: fixtureStatus === 'ambiguous',
          amountCents: snapshot.priceCents, currency: snapshot.currency, snapshot,
          requirements: ['original edition', 'manufacturer warranty'],
          analysis: { ...mockAnalysis(snapshot, ['original edition', 'manufacturer warranty'], true), notices: ['MOCK source exclusion notice. A fixture seller passage was excluded; no model call occurred.'] },
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          approvalUrl: null, message: 'MOCK UI FIXTURE. No provider response, buyer approval or payment occurred.',
        });
      }
      const order = orders.get(id);
      if (segments[4] === 'cancel' && method === 'POST' && order.status === 'awaiting_approval') order.status = 'cancelled';
      else if (method === 'POST') fail('paypal_disabled', 'MOCK provider actions disabled', 503);
      if (!value) value = { order };
    } else fail('mock_route_unavailable', 'MOCK UI fixture has no provider or account actions', 503);
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
  });
}

async function mockModelStateChecks(page, origin) {
  await page.goto(`${origin}/?listing=atlas-station`, { waitUntil: 'domcontentloaded' });
  await page.locator('#requirement-1').waitFor();
  for (const [index, value] of ['original edition', 'complete contents', 'manufacturer warranty'].entries()) {
    await page.locator(`#requirement-${index + 1}`).fill(value);
  }
  await page.locator('#analyze-button').click();
  await page.locator('[data-testid="evidence-3"]').waitFor();
  await check('MOCK match, contradiction and unknown cards use visible status words', async () => {
    for (const [index, status] of ['Match', 'Contradiction', 'Unknown'].entries()) {
      assert.equal(await page.locator(`[data-testid="evidence-${index + 1}"] .result-status`).innerText(), status);
    }
  });
  await screenshot(page, 'MOCK-evidence-three-statuses.png');
  await page.locator('#requirement-1').fill('invalid fixture');
  await page.locator('#requirement-2').fill('');
  await page.locator('#requirement-3').fill('');
  await page.locator('#analyze-button').click();
  await page.locator('[data-testid="evidence-1"] .validation-note').filter({ hasText: 'MOCK malformed-output fixture; unsupported output remains unknown.' }).waitFor();
  await check('MOCK invalid output visibly fails closed to unknown', async () => {
    assert.equal(await page.locator('[data-testid="evidence-1"] .result-status').innerText(), 'Unknown');
    assert.match(await page.locator('[data-testid="evidence-1"]').innerText(), /Validation invalid/);
    assert.equal(await page.locator('[data-testid="evidence-1"] blockquote').count(), 0);
  });
  await screenshot(page, 'MOCK-evidence-invalid.png');
  await page.locator('#requirement-1').fill('manual condition (MOCK context fixture)');
  await page.locator('#analyze-button').click();
  await page.getByText('Exact seller context · no conclusion', { exact: true }).waitFor();
  const contextReviewId = new URL(page.url()).searchParams.get('review');
  await check('MOCK valid unknown context keeps exact seller text without a known conclusion', async () => {
    const card = page.locator('[data-testid="evidence-1"]');
    assert.equal(await card.locator('.result-status').innerText(), 'Unknown');
    assert.equal(await card.locator('blockquote').innerText(), 'The original box and original assembly manual are included.');
    assert.match(await card.innerText(), /Exact seller context · no conclusion/);
    assert.doesNotMatch(await card.innerText(), /Validation invalid/);
    assert.match(await page.locator('main').innerText(), /MOCK-evidence-v2/);
    assert.match(await page.locator('[data-testid="evidence-notices"]').innerText(), /Some seller text was excluded/);
    assert.match(await page.locator('[data-testid="evidence-notices"]').innerText(), /MOCK source exclusion notice/);
  });
  await screenshot(page, 'MOCK-unknown-context-desktop.png');
  await check('MOCK unknown context uses explicit keyboard acknowledgement and confirmation', async () => {
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);
    assert.equal(await page.locator('#confirm-review').isDisabled(), true);
    await page.locator('#review-acknowledgement').focus();
    await page.keyboard.press('Space');
    const confirmed = page.waitForResponse(response => new URL(response.url()).pathname === `/api/reviews/${contextReviewId}/confirm` && response.request().method() === 'POST');
    await page.locator('#confirm-review').focus();
    await page.keyboard.press('Enter');
    assert.ok((await confirmed).ok());
    await page.waitForFunction(() => document.activeElement?.id === 'approval-heading');
  });
  await check('MOCK valid unknown context and version survive refresh', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Exact seller context · no conclusion', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('review'), contextReviewId);
    assert.equal(await page.locator('[data-testid="evidence-1"] .result-status').innerText(), 'Unknown');
    assert.equal(await page.locator('[data-testid="evidence-1"] blockquote').count(), 1);
    assert.match(await page.locator('main').innerText(), /MOCK-evidence-v2/);
    assert.match(await page.locator('[data-testid="evidence-notices"]').innerText(), /MOCK source exclusion notice/);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await check('MOCK valid unknown context has no mobile horizontal overflow', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.match(await page.locator('[data-testid="evidence-1"]').innerText(), /Exact seller context · no conclusion/);
  });
  await screenshot(page, 'MOCK-unknown-context-mobile.png');
  await page.setViewportSize({ width: 1280, height: 900 });
}

async function mockReceiptChecks(page, origin) {
  for (const [status, heading] of [
    ['pending', /pending/i], ['ambiguous', /uncertain/i],
    ['failed', /not completed/i], ['cancelled', /cancelled/i],
  ]) {
    await page.goto(`${origin}/?order=mock-${status}&checkout=return`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="checkout-state"]').waitFor();
    await check(`MOCK receipt ${status} does not claim a completed capture`, async () => {
      assert.match(await page.locator('#receipt-heading').innerText(), heading);
      assert.equal(await page.locator('[data-testid="checkout-state"]').innerText(), status);
      const captureText = await page.locator('[data-testid="actual-capture-status"]').innerText();
      if (status === 'pending') assert.equal(captureText, 'PENDING');
      else if (status === 'failed') assert.equal(captureText, 'DECLINED');
      else assert.match(captureText, /No .*capture|Not recorded|Unknown/i);
      const providerText = await page.locator('[data-testid="provider-order-status"]').innerText();
      if (status === 'pending') assert.equal(providerText, 'COMPLETED');
      if (status === 'ambiguous') assert.match(await page.locator('main').innerText(), /Latest provider verification needs attention/);
      assert.match(await page.locator('[data-testid="evidence-notices"]').innerText(), /Some seller text was excluded/);
      assert.match(await page.locator('[data-testid="evidence-notices"]').innerText(), /MOCK source exclusion notice/);
      assert.match(await page.locator('body').innerText(), /MOCK UI FIXTURE/);
      assert.doesNotMatch(await page.locator('[data-testid="actual-capture-status"]').innerText(), /COMPLETED/);
      const snapshotData = await page.locator('.receipt-data').innerText();
      assert.match(snapshotData, /Server amount\s+\$48\.00/);
      assert.match(snapshotData, /Listing version\s+1/);
      assert.ok(!(await page.locator('.snapshot-description').innerText()).includes('Controlled browser QA merchant edit.'), 'Receipt must retain its pre-edit description snapshot');
      const capture = page.locator('#capture-order');
      if (await capture.count()) assert.equal(await capture.isDisabled(), true);
    });
    await screenshot(page, `MOCK-receipt-${status}.png`);
  }
  await page.goto(`${origin}/?order=mock-awaiting_approval&checkout=cancel`, { waitUntil: 'domcontentloaded' });
  await page.locator('#cancel-order').waitFor();
  await page.locator('#cancel-order').click();
  await page.getByRole('heading', { name: 'Checkout cancelled', exact: true }).waitFor();
  await check('MOCK explicit local cancellation records cancelled, never paid', async () => {
    assert.equal(await page.locator('[data-testid="checkout-state"]').innerText(), 'cancelled');
    assert.match(await page.locator('[data-testid="actual-capture-status"]').innerText(), /No .*capture|Not recorded|Unknown/i);
  });
  await screenshot(page, 'MOCK-cancel-action.png');
}

async function appChecks(page) {
  const origin = process.argv.includes('--isolated-qa') ? 'http://127.0.0.1:4322' : process.env.APP_ORIGIN || 'http://127.0.0.1:4310';
  const parsed = new URL(origin);
  assert.equal(parsed.hostname, '127.0.0.1', 'QA must use the requested loopback host');
  assert.equal(parsed.protocol, 'http:');
  assert.equal(parsed.pathname, '/');
  report.url = origin;
  report.viewports = process.argv.includes('--catalogue-only') ? [{ width: 1280, height: 900 }] : [{ width: 1280, height: 900 }, { width: 390, height: 844 }];
  if (report.mockUI) await installMockUI(page, origin);
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="listing-orbit-courier"]').waitFor();
  await check('page identity', async () => {
    assert.equal(new URL(page.url()).origin, origin);
    assert.match(await page.title(), /Second Look|seller statement review/i);
  });
  await check('meaningful catalogue and six original synthetic listings', async () => {
    assert.equal(await page.locator('[data-testid^="listing-"]').count(), 6);
    assert.match(await page.locator('body').innerText(), /synthetic|fictional/i);
    assert.ok((await page.locator('main').innerText()).length > 100);
  });
  await check('no framework error overlay', async () => {
    assert.equal(await page.locator('vite-error-overlay, nextjs-portal, [data-nextjs-dialog]').count(), 0);
  });
  await check('desktop no horizontal overflow', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await screenshot(page, process.argv.includes('--catalogue-only') ? 'CURRENT-catalogue-desktop.png' : '01-catalogue-desktop.png');
  if (process.argv.includes('--catalogue-only')) {
    await check('current catalogue capture uses only read-only configuration/listing APIs', async () => {
      assert.ok(report.requests.every(request => request.method === 'GET' && ['/api/config', '/api/listings'].includes(request.path)));
    });
    await check('console health', async () => assert.deepEqual(report.consoleErrors, []));
    return;
  }
  await check('keyboard skip link', async () => {
    await page.keyboard.press('Tab');
    assert.match(await page.locator(':focus').innerText(), /Skip to content/i);
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#main');
    await page.waitForFunction(() => document.activeElement?.id === 'main', null, { timeout: 3000 });
  });
  await page.locator('[data-testid="listing-orbit-courier"]').click();
  await page.locator('#requirement-1').waitFor();
  await check('listing retains seller statement disclaimer and server-owned price', async () => {
    assert.match(await page.locator('body').innerText(), /seller statements/i);
    assert.match(await page.locator('body').innerText(), /48\.00/);
  });
  for (const [index, requirement] of ['original edition', report.mockUI ? 'all four antenna pieces' : 'complete contents', report.mockUI ? 'manufacturer warranty' : 'original box'].entries()) {
    await page.locator(`#requirement-${index + 1}`).fill(requirement);
  }
  await screenshot(page, '02-requirements-desktop.png');
  const analysisResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/reviews' && response.request().method() === 'POST', { timeout: 150000 });
  const requestCount = report.requests.filter(request => request.path === '/api/reviews' && request.method === 'POST').length;
  await page.locator('#analyze-button').click();
  await check('loading disables repeated review submission', async () => {
    assert.equal(await page.locator('#analyze-button').isDisabled(), true);
    await page.locator('#analyze-button').click({ force: true });
  });
  const response = await analysisResponse;
  const payload = await response.json();
  assert.ok(response.ok(), `Review request failed (${response.status()}): ${payload.error?.message || 'no detail'}`);
  await check('repeated click produced one review request', async () => {
    assert.equal(report.requests.filter(request => request.path === '/api/reviews' && request.method === 'POST').length, requestCount + 1);
  });
  const review = payload.review;
  report.review = { id: review.id, version: review.listingVersion, model: review.analysis.model, evidenceVersion: review.analysis.evidenceVersion, durationMs: review.analysis.durationMs, results: review.analysis.results };
  if (!report.mockUI) await check('live review receives the current local model response rather than unavailable fallback', async () => {
    assert.equal(review.analysis.model, 'qwen3.5:4b-q4_K_M');
    assert.equal(review.analysis.evidenceVersion, process.env.EXPECTED_EVIDENCE_VERSION || '2026-10-10-v2');
    assert.ok(review.analysis.durationMs > 0);
    assert.equal(review.analysis.results.some(result => result.validation === 'unavailable'), false);
  });
  await page.locator('#review-acknowledgement').waitFor({ timeout: 10000 });
  await check('requirements remain beside visible status and exact source quotes', async () => {
    const text = await page.locator('main').innerText();
    for (const result of review.analysis.results) {
      assert.ok(text.includes(result.requirement), 'Buyer requirement is missing from evidence view');
      assert.ok(['match', 'contradiction', 'unknown'].includes(result.status));
      for (const quote of result.quotes) assert.ok(text.includes(quote), 'Exact seller quote is missing from evidence view');
    }
    if (review.analysis.results.some(result => result.status === 'unknown')) assert.match(text, /unknown/i);
    if (review.analysis.results.some(result => result.validation !== 'valid')) assert.match(text, /invalid|unavailable|untrusted|could not|unknown/i);
  });
  await check('explicit acknowledgement required before review confirmation', async () => {
    assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);
    assert.equal(await page.locator('#confirm-review').isDisabled(), true);
  });
  await screenshot(page, '03-evidence-desktop.png');
  await page.locator('#review-acknowledgement').focus();
  await page.keyboard.press('Space');
  await check('editing an unconfirmed draft disables an enabled buyer confirmation', async () => {
    assert.equal(await page.locator('#confirm-review').isDisabled(), false);
    const requirement = page.locator('#requirement-1');
    const original = await requirement.inputValue();
    await requirement.fill(original + ' with matching edition markings');
    assert.equal(await page.locator('#confirm-review').isDisabled(), true);
    assert.equal(await page.locator('#review-acknowledgement').isDisabled(), true);
    await page.locator('#draft-note').waitFor({ state: 'visible' });
    await requirement.fill(original);
    assert.equal(await page.locator('#review-acknowledgement').isDisabled(), false);
    if (!(await page.locator('#review-acknowledgement').isChecked())) {
      await page.locator('#review-acknowledgement').focus();
      await page.keyboard.press('Space');
    }
    assert.equal(await page.locator('#confirm-review').isDisabled(), false);
  });
  const confirmResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/confirm') && response.request().method() === 'POST');
  await page.locator('#confirm-review').focus();
  await page.keyboard.press('Enter');
  assert.ok((await confirmResponse).ok());
  await check('confirmation restores keyboard focus to its heading', async () => {
    await page.waitForFunction(() => document.activeElement?.id === 'approval-heading');
  });
  await check('sandbox checkout is visibly disabled without configuration', async () => {
    await page.locator('#create-checkout').waitFor();
    assert.equal(await page.locator('#create-checkout').isDisabled(), true);
    assert.match(await page.locator('main').innerText(), /disabled|credentials|not configured/i);
  });
  await check('review persists after refresh', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#create-checkout').waitFor();
    assert.equal(await page.locator('#create-checkout').isDisabled(), true);
    assert.ok(new URL(page.url()).searchParams.get('review') === review.id);
  });
  await check('editing requirements requires a new review before further approval', async () => {
    const requirement = page.locator('#requirement-1');
    const original = await requirement.inputValue();
    await requirement.fill(original + ' with matching edition markings');
    assert.equal(await page.locator('#create-checkout').isDisabled(), true);
    const confirm = page.locator('#confirm-review');
    if (await confirm.count()) assert.equal(await confirm.isDisabled(), true);
    await page.getByText(/Edited requirements need a new review|requirements changed|run another review/i).first().waitFor();
    await requirement.fill(original);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await check('mobile no horizontal overflow', async () => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await screenshot(page, '04-evidence-mobile.png');
  if (process.argv.includes('--merchant-edit')) {
    await page.setViewportSize({ width: 1280, height: 900 });
    const editor = page.locator('#merchant-editor');
    if (!(await editor.evaluate(node => node.open))) await editor.locator('summary').click();
    const originalDescription = await page.locator('#merchant-description').inputValue();
    const originalPrice = await page.locator('#merchant-price').inputValue();
    await page.locator('#merchant-description').fill(originalDescription + ' Controlled browser QA merchant edit.');
    await page.locator('#merchant-price').fill((Number(originalPrice) + 1).toFixed(2));
    const editResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/merchant/listings/orbit-courier' && response.request().method() === 'POST');
    const staleReviewResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/reviews/${review.id}` && response.request().method() === 'GET');
    await page.locator('#save-merchant-edit').click();
    const savedEditResponse = await editResponse;
    assert.ok(savedEditResponse.ok());
    const savedEdit = (await savedEditResponse.json()).listing;
    const savedStaleReviewResponse = await staleReviewResponse;
    assert.ok(savedStaleReviewResponse.ok());
    const staleReview = (await savedStaleReviewResponse.json()).review;
    report.merchantEdited = { version: savedEdit.version, priceCents: savedEdit.priceCents, currency: savedEdit.currency };
    report.staleReview = { id: staleReview.id, version: staleReview.listingVersion, priceCents: staleReview.snapshot.priceCents, stale: staleReview.stale };
    await check('merchant edit visibly invalidates reviewed version', async () => {
      await page.getByText(/out of date|stale|listing changed|run another review/i).first().waitFor();
      const confirm = page.locator('#confirm-review');
      if (await confirm.count()) assert.equal(await confirm.isDisabled(), true);
      const checkout = page.locator('#create-checkout');
      if (await checkout.count()) assert.equal(await checkout.isDisabled(), true);
      assert.equal(await page.locator('#review-acknowledgement').isDisabled(), true);
      assert.equal(staleReview.stale, true);
      assert.equal(staleReview.listingVersion, review.listingVersion);
      assert.equal(staleReview.snapshot.priceCents, review.snapshot.priceCents);
      assert.equal(staleReview.snapshot.description, review.snapshot.description);
      assert.equal(savedEdit.version, review.listingVersion + 1);
      assert.equal(savedEdit.priceCents, review.snapshot.priceCents + 100);
      assert.equal(await page.locator('[data-testid="seller-description"]').innerText(), savedEdit.description);
      assert.equal(await page.locator('.detail-price').innerText(), `$${(savedEdit.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.review-amount').innerText(), `$${(review.snapshot.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.evidence-section > .section-heading .quiet-label').innerText(), `Listing version ${review.listingVersion}`);
    });
    await screenshot(page, '05-stale-review-desktop.png');
    report.merchantEdit = report.mockUI
      ? 'MOCK browser-only merchant edit incremented the fixture version. No server listing was changed.'
      : 'Opt-in --merchant-edit changed the synthetic listing and incremented its server version; original text/price are recorded below for reset.';
    report.merchantOriginal = { description: originalDescription, price: originalPrice };
    const rereviewResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/reviews' && response.request().method() === 'POST', { timeout: 150000 });
    await page.locator('#analyze-button').click();
    const savedRereviewResponse = await rereviewResponse;
    assert.ok(savedRereviewResponse.ok());
    const rereview = (await savedRereviewResponse.json()).review;
    report.rereview = { id: rereview.id, version: rereview.listingVersion, priceCents: rereview.snapshot.priceCents, model: rereview.analysis.model, evidenceVersion: rereview.analysis.evidenceVersion, durationMs: rereview.analysis.durationMs, results: rereview.analysis.results };
    await page.locator('#review-acknowledgement').waitFor();
    await page.locator('.evidence-section > .section-heading .quiet-label').filter({ hasText: `Listing version ${savedEdit.version}` }).waitFor();
    await check('changed listing requires a fresh unconfirmed review snapshot', async () => {
      assert.notEqual(rereview.id, review.id);
      assert.equal(rereview.listingVersion, savedEdit.version);
      assert.equal(rereview.snapshot.priceCents, savedEdit.priceCents);
      assert.equal(rereview.snapshot.description, savedEdit.description);
      if (!report.mockUI) {
        assert.equal(rereview.analysis.evidenceVersion, review.analysis.evidenceVersion);
        assert.ok(rereview.analysis.durationMs > 0);
        assert.equal(rereview.analysis.results.some(result => result.validation === 'unavailable'), false);
      }
      assert.equal(rereview.confirmedAt, null);
      assert.equal(rereview.stale, false);
      assert.equal(await page.locator('#review-acknowledgement').isChecked(), false);
      assert.equal(await page.locator('#review-acknowledgement').isDisabled(), false);
      assert.equal(await page.locator('#confirm-review').isDisabled(), true);
      assert.equal(await page.locator('[data-testid="seller-description"]').innerText(), savedEdit.description);
      assert.equal(await page.locator('.detail-price').innerText(), `$${(savedEdit.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.review-amount').innerText(), `$${(rereview.snapshot.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.evidence-section > .section-heading .quiet-label').innerText(), `Listing version ${rereview.listingVersion}`);
      await page.waitForFunction(() => document.activeElement?.id === 'evidence-heading');
    });
    await screenshot(page, '07-fresh-review-desktop.png');
    await page.locator('#review-acknowledgement').focus();
    await page.keyboard.press('Space');
    const reconfirmResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/reviews/${rereview.id}/confirm` && response.request().method() === 'POST');
    await page.locator('#confirm-review').focus();
    await page.keyboard.press('Enter');
    const savedReconfirmResponse = await reconfirmResponse;
    assert.ok(savedReconfirmResponse.ok());
    const reconfirmed = (await savedReconfirmResponse.json()).review;
    await check('buyer explicitly approves the fresh version before disabled checkout', async () => {
      assert.ok(reconfirmed.confirmedAt);
      assert.equal(reconfirmed.listingVersion, savedEdit.version);
      await page.waitForFunction(() => document.activeElement?.id === 'approval-heading');
      assert.equal(await page.locator('#create-checkout').isDisabled(), true);
    });
    report.rereview.confirmedAt = reconfirmed.confirmedAt;
    await screenshot(page, '08-fresh-approval-desktop.png');
  }
  await check('back/navigation returns a working catalogue', async () => {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="listing-orbit-courier"]').waitFor();
    assert.equal(new URL(page.url()).searchParams.has('listing'), false);
    assert.equal(await page.locator('[data-testid^="listing-"]').count(), 6);
  });
  await check('browser forward restores the saved review and shop link still works', async () => {
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await page.locator('#create-checkout').waitFor();
    assert.equal(new URL(page.url()).searchParams.get('review'), report.rereview?.id || review.id);
    assert.equal(await page.locator('#create-checkout').isDisabled(), true);
    await page.getByRole('link', { name: 'The shop', exact: true }).click();
    await page.locator('[data-testid="listing-orbit-courier"]').waitFor();
    assert.equal(await page.locator('[data-testid^="listing-"]').count(), 6);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot(page, '06-catalogue-mobile.png');
  if (report.mockUI) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockModelStateChecks(page, origin);
    await mockReceiptChecks(page, origin);
  }
  await check('disabled checkout makes no order creation or provider action request', async () => {
    assert.equal(report.requests.some(request => request.method === 'POST' && (request.path === '/api/orders' || /\/(capture|reconcile)$/.test(request.path))), false);
  });
  await check('console health', async () => assert.deepEqual(report.consoleErrors, []));
}

try {
  browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Users/alexa/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe',
    headless: true,
    chromiumSandbox: true,
  });
  report.browser = await browser.version();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/')) report.requests.push({ method: request.method(), path: url.pathname }); });
  page.on('pageerror', error => report.consoleErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  if (process.argv.includes('--probe')) {
    await page.goto('data:text/html,<title>Second Look browser route probe</title><label for="n">Probe text</label><input id="n"><button type="button" onclick="document.querySelector(\'output\').textContent=document.querySelector(\'input\').value">Apply</button><output aria-live="polite"></output>');
    await check('page identity', async () => assert.equal(await page.title(), 'Second Look browser route probe'));
    await check('typing and click interaction', async () => {
      await page.getByLabel('Probe text').fill('Browser automation works');
      await page.getByRole('button', { name: 'Apply' }).click();
      assert.equal(await page.locator('output').textContent(), 'Browser automation works');
    });
    await check('keyboard operation', async () => {
      await page.getByLabel('Probe text').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').textContent(), 'Apply');
      await page.keyboard.press('Enter');
    });
    const path = resolve(out, 'route-probe.png');
    await page.screenshot({ path }); report.screenshots.push(path);
    await check('console health', async () => assert.deepEqual(report.consoleErrors, []));
  } else {
    await appChecks(page);
  }
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(out, process.argv.includes('--probe') ? 'route-probe.json' : process.argv.includes('--catalogue-only') ? 'CURRENT-report.json' : report.mockUI ? 'MOCK-report.json' : 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
