import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createApp } from '../server.mjs';

// Real app HTTP request handler, in-process transport double. Initial restricted
// loopback fetch returned EACCES; check-http.mjs separately records the actual
// approved-context network smoke. This test is not a live HTTP or browser pass.
async function dispatch(server, base, path, options = {}) {
  const bytes = options.body === undefined ? [] : [Buffer.from(options.body)];
  const request = Readable.from(bytes);
  request.method = options.method || 'GET';
  request.url = path;
  request.headers = { host: new URL(base).host, ...Object.fromEntries(Object.entries(options.headers || {}).map(([key,value]) => [key.toLowerCase(),value])) };
  const headers = new Map();
  return new Promise(resolveResponse => {
    const response = { statusCode: 200, setHeader(name,value) { headers.set(name.toLowerCase(),value); }, end(body) { const value = body?.toString() || ''; resolveResponse({ status:this.statusCode, headers:{ get:name => headers.get(name.toLowerCase()) || null }, json:async () => JSON.parse(value), text:async () => value }); } };
    server.emit('request', request, response);
  });
}

async function fixture(t) {
  const calls = [];
  const service = Object.fromEntries(['getListings','getListing','createReview','getReview','confirmReview','createOrder','getOrder','captureOrder','reconcileOrder','cancelOrder','editListing'].map(name => [name, async (...args) => { calls.push({ name, args }); return name === 'getListings' ? [] : { id: 'fixture', status: 'ambiguous' }; }]));
  const server = await createApp({ service, paypal: { configured: false }, origin: 'http://127.0.0.1:4319' });
  const base = 'http://127.0.0.1:4319';
  const configResponse = await dispatch(server,base,'/api/config');
  const cookie = configResponse.headers.get('set-cookie').split(';')[0];
  const config = await configResponse.json();
  const post = (path, body, extra = {}) => dispatch(server,base,path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, 'X-CSRF-Token': config.csrfToken, ...extra }, body: JSON.stringify(body) });
  return { base, cookie, config, post, calls, server };
}

test('HTTP handler (mock transport): disabled sandbox, signed session and CSRF protect all writes', async t => {
  const f = await fixture(t);
  assert.equal(f.config.paypal.configured, false);
  assert.equal(f.config.paypal.mode, 'sandbox');
  assert.equal((await f.post('/api/orders', { reviewId: 'r' }, { Origin: 'http://other.invalid' })).status, 403);
  assert.equal((await f.post('/api/orders', { reviewId: 'r' }, { 'X-CSRF-Token': 'forged' })).status, 403);
  assert.equal((await f.post('/api/orders', { reviewId: 'r' }, { Cookie: 'second_look_session=forged' })).status, 403);
  assert.equal(f.calls.length, 0);
  const accepted = await f.post('/api/orders', { reviewId: 'r' });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).order.status, 'ambiguous');
  assert.equal(f.calls[0].name, 'createOrder');
  assert.match(f.calls[0].args[0], /^[a-f0-9-]{36}$/);
});

test('HTTP handler (mock transport): rejects client prices/paid state, oversized/malformed bodies and wrong media', async t => {
  const f = await fixture(t);
  for (const body of [{ reviewId: 'r', priceCents: 1 }, { reviewId: 'r', currency: 'EUR' }, { reviewId: 'r', paid: true }]) assert.equal((await f.post('/api/orders', body)).status, 400);
  assert.equal((await f.post('/api/orders/x/capture', { status: 'COMPLETED' })).status, 400);
  assert.equal((await f.post('/api/reviews', { listingId: 'x', requirements: ['x'.repeat(9000)] })).status, 413);
  assert.equal((await f.post('/api/orders', { reviewId: 'r' }, { 'Content-Type': 'text/plain' })).status, 415);
  const malformed = await dispatch(f.server,f.base,'/api/orders', { method:'POST', headers:{'Content-Type':'application/json',Origin:f.base,Cookie:f.cookie,'X-CSRF-Token':f.config.csrfToken},body:'{' });
  assert.equal(malformed.status,400);
  assert.equal(f.calls.length, 0);
});

test('HTTP handler (mock transport): serves only public assets and applies basic browser protections', async t => {
  const f = await fixture(t);
  for (const path of ['/.env','/server.mjs','/.data/second-look.sqlite','/CONTRACT.md','/%2eenv','/lib/paypal.mjs']) assert.equal((await dispatch(f.server,f.base,path)).status,404);
  const response = await dispatch(f.server,f.base,'/api/listings');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(response.headers.get('cache-control'),'no-store');
});
