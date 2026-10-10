/** Optional browser QA. Runtime application code has no Playwright dependency. */
import { createRequire } from 'node:module';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { installMockUI, mockModelStateChecks, mockReceiptChecks } from './browser-v3-fixtures.mjs';

const require = createRequire(import.meta.url);
const bundledPlaywright = 'C:/Users/alexa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
catch { playwright = require(bundledPlaywright); }

const out = resolve('artifacts/browser/v3');
await mkdir(out, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  engine: 'Existing Playwright / Chromium, headless interactive automation',
  browserPlugin: 'Absent: Browser skill is not listed',
  cuaFailure: 'MXC launcher cannot locate required Windows platform directory: HRESULT 0x80070003; one attempt, no retry',
  chromiumSandbox: true, checks: [], consoleErrors: [], screenshots: [], screenshotStates: [],
  flow: process.argv.includes('--catalogue-only') ? 'current catalogue only; read-only API GETs, no model or provider requests' : 'catalogue -> listing -> up to three requirements -> suggested seller quotes and neutral questions -> saved full seller context -> explicit review -> disabled sandbox checkout' + (process.argv.includes('--merchant-edit') ? ' -> controlled merchant edit -> stale review -> fresh review and approval' : ''),
  scope: 'Local synthetic listings only; no payment, account or credential actions',
  mockUI: process.argv.includes('--mock-ui'),
  requests: [],
};
let browser;
const runOut = resolve(out, 'runs', `${report.startedAt.replace(/[:.]/g, '-')}-${report.mockUI ? 'MOCK' : 'ACTUAL'}`);
await mkdir(runOut, { recursive: true });
report.artifactDirectory = runOut;

async function check(name, fn) {
  try { await fn(); report.checks.push({ name, pass: true }); }
  catch (error) { report.checks.push({ name, pass: false, error: error.message }); throw error; }
}

function assertSnapshotSources(analysis, description) {
  assert.equal(analysis.kind, 'quote-suggestions');
  assert.equal(analysis.sourceDigest, createHash('sha256').update(description).digest('hex'));
  assert.ok(Array.isArray(analysis.sourceSpans));
  const spans = new Map();
  for(const span of analysis.sourceSpans) {
    assert.equal(typeof span.id,'string');assert.equal(spans.has(span.id),false);
    assert.ok(Number.isInteger(span.start) && Number.isInteger(span.end) && span.start>=0 && span.end>span.start && span.end<=description.length);
    assert.equal(description.slice(span.start,span.end),span.text);spans.set(span.id,span);
  }
  for(const result of analysis.results) {
    assert.equal(Object.hasOwn(result,'status'),false);
    for(const suggestion of result.suggestions) {
      const span=spans.get(suggestion.spanId);assert.equal(span?.eligible,true);
      assert.equal(span.text,suggestion.quote);assert.equal(description.slice(span.start,span.end),suggestion.quote);
    }
  }
}

async function screenshot(page, name) {
  if (report.mockUI && !name.startsWith('MOCK-')) name = `MOCK-${name}`;
  const path = resolve(runOut, name);
  const state = await page.evaluate(() => {
    const skip = document.querySelector('.skip-link');
    const rect = skip?.getBoundingClientRect();
    return { focus: document.activeElement?.id || document.activeElement?.tagName, scrollY, skipFocused: document.activeElement === skip, skipRect: rect ? { top: rect.top, bottom: rect.bottom } : null };
  });
  // Capture from the top so Chromium does not composite a transformed fixed
  // skip-link into a full-page image at the previous viewport scroll offset.
  if (state.scrollY) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
  await copyFile(path, resolve(out, name));
  report.screenshots.push(path);
  report.screenshotStates.push({ file: name, ...state, capturedScrollY: 0 });
  if (state.scrollY) await page.evaluate(y => window.scrollTo(0, y), state.scrollY);
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
  report.review = { id: review.id, version: review.listingVersion, model: review.analysis.model, evidenceVersion: review.analysis.evidenceVersion, durationMs: review.analysis.durationMs, kind:review.analysis.kind, sourceDigest:review.analysis.sourceDigest, sourceSpans:review.analysis.sourceSpans, results: review.analysis.results };
  if (!report.mockUI) await check('live review receives the current local model response rather than unavailable fallback', async () => {
    assert.equal(review.analysis.model, 'qwen3.5:4b-q4_K_M');
    assertSnapshotSources(review.analysis,review.snapshot.description);
    assert.equal(review.analysis.evidenceVersion, process.env.EXPECTED_EVIDENCE_VERSION || '2026-10-10-v3');
    assert.ok(review.analysis.durationMs > 0);
    assert.equal(review.analysis.results.some(result => result.validation === 'unavailable'), false);
  });
  await page.locator('#review-acknowledgement').waitFor({ timeout: 10000 });
  await check('requirements remain beside unverified suggested quotes and full saved seller context', async () => {
    const text = await page.locator('main').innerText();
    assert.equal(review.analysis.kind, 'quote-suggestions');
    assert.equal(await page.locator('[data-testid="review-snapshot-text"]').innerText(), review.snapshot.description);
    assertSnapshotSources(review.analysis,review.snapshot.description);
    for (const [index,result] of review.analysis.results.entries()) {
      const card=page.locator(`[data-testid="evidence-${index+1}"]`);
      assert.ok((await card.innerText()).includes(result.requirement), 'Buyer requirement is missing from its suggestion card');
      assert.equal(Object.hasOwn(result,'status'), false);
      if(result.validation==='valid') {
        for (const [quoteIndex,suggestion] of result.suggestions.entries()) {
          assert.equal(await page.locator(`[data-testid="suggested-quote-${index+1}-${quoteIndex+1}"]`).innerText(), suggestion.quote);
        }
        for(const [questionIndex,question] of result.questions.entries()) {
          assert.equal(await page.locator(`[data-testid="neutral-question-${index+1}-${questionIndex+1}"]`).innerText(), question.text);
        }
      } else {
        assert.equal(await card.locator('blockquote').count(),0);
        assert.match(await card.innerText(),/Source check failed|Suggestions unavailable/u);
      }
    }
    for(const label of await page.locator('.result-status, .integrity-state').allTextContents()) assert.doesNotMatch(label,/^(Match|Contradiction|Unknown)$/iu);
    assert.match(text,/source integrity|unverified|do not verify/iu);
    assert.match(await page.locator('.seller-warning').innerText(),/do not decide|not authentication|not.*truth|unverified/iu);
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
      assert.equal(await page.locator('[data-testid="review-snapshot-text"]').innerText(), review.snapshot.description);
      assert.equal(savedEdit.version, review.listingVersion + 1);
      assert.equal(savedEdit.priceCents, review.snapshot.priceCents + 100);
      assert.equal(await page.locator('[data-testid="seller-description"]').innerText(), savedEdit.description);
      assert.equal(await page.locator('.detail-price').innerText(), `$${(savedEdit.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.review-amount').innerText(), `$${(review.snapshot.priceCents / 100).toFixed(2)}`);
      assert.equal(await page.locator('.evidence-section > .section-heading .quiet-label').innerText(), `Saved version ${review.listingVersion}`);
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
    report.rereview = { id: rereview.id, version: rereview.listingVersion, priceCents: rereview.snapshot.priceCents, model: rereview.analysis.model, evidenceVersion: rereview.analysis.evidenceVersion, durationMs: rereview.analysis.durationMs, kind:rereview.analysis.kind, sourceDigest:rereview.analysis.sourceDigest, sourceSpans:rereview.analysis.sourceSpans, results: rereview.analysis.results };
    await page.locator('#review-acknowledgement').waitFor();
    await page.locator('.evidence-section > .section-heading .quiet-label').filter({ hasText: `Saved version ${savedEdit.version}` }).waitFor();
    await check('changed listing requires a fresh unconfirmed review snapshot', async () => {
      assert.notEqual(rereview.id, review.id);
      assert.equal(rereview.listingVersion, savedEdit.version);
      assert.equal(rereview.snapshot.priceCents, savedEdit.priceCents);
      assert.equal(rereview.snapshot.description, savedEdit.description);
      assertSnapshotSources(rereview.analysis,savedEdit.description);
      assert.notEqual(rereview.analysis.sourceDigest,review.analysis.sourceDigest);
      assert.equal(await page.locator('[data-testid="review-snapshot-text"]').innerText(), savedEdit.description);
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
      assert.equal(await page.locator('.evidence-section > .section-heading .quiet-label').innerText(), `Saved version ${rereview.listingVersion}`);
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
    await mockModelStateChecks(page, origin, {check,screenshot});
    await mockReceiptChecks(page, origin, {check,screenshot});
  }
  await check('disabled checkout makes no order creation or provider action request', async () => {
    assert.equal(report.requests.some(request => request.method === 'POST' && (request.path === '/api/orders' || /\/(capture|reconcile)$/.test(request.path))), false);
  });
  await check('console health', async () => assert.deepEqual(report.consoleErrors, []));
}

try {
  if(!report.mockUI && !process.argv.includes('--catalogue-only') && !process.argv.includes('--probe')) {
    const freeze=JSON.parse(await readFile(resolve('artifacts/model-check/freeze-v3.json'),'utf8'));
    const moduleSha256=createHash('sha256').update(await readFile(resolve('lib/evidence.mjs'))).digest('hex');
    assert.equal(freeze.moduleSha256,moduleSha256,'Natural browser QA must use the frozen source, without post-freeze tuning.');
    assert.equal(freeze.version,process.env.EXPECTED_EVIDENCE_VERSION || '2026-10-10-v3');
    report.frozenModelContract={version:freeze.version,moduleSha256,frozenAt:freeze.frozenAt};
  }
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
  const reportName = process.argv.includes('--probe') ? 'route-probe.json' : process.argv.includes('--catalogue-only') ? 'CURRENT-report.json' : report.mockUI ? 'MOCK-report.json' : 'report.json';
  const reportJson = JSON.stringify(report, null, 2) + '\n';
  // Keep every attempt, including failures, before updating the convenient latest file.
  await writeFile(resolve(out, `${report.startedAt.replace(/[:.]/g, '-')}-${reportName}`), reportJson);
  await writeFile(resolve(out, reportName), reportJson);
  console.log(JSON.stringify(report, null, 2));
}
