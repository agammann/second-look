import http from 'node:http';
import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './lib/store.mjs';
import { createService } from './lib/service.mjs';
import { createPayPal } from './lib/paypal.mjs';
import { analyzeListing } from './lib/evidence.mjs';
import { initialListings } from './lib/catalog.mjs';
import { brand, modelName } from './lib/brand.mjs';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(projectRoot, 'public');
const COOKIE = 'second_look_session';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const safeEqual = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fault = (status, code, message) => Object.assign(new Error(message), { status, code });

async function loadKey(dataDir) {
  await mkdir(dataDir, { recursive: true });
  const path = resolve(dataDir, 'session-key');
  try { return await readFile(path); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = randomBytes(32);
    try { await writeFile(path, key, { flag: 'wx', mode: 0o600 }); return key; }
    catch (writeError) { if (writeError.code === 'EEXIST') return readFile(path); throw writeError; }
  }
}

async function bodyJSON(request, allowed) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') throw fault(415, 'json_required', 'Send JSON for this action.');
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw fault(413, 'body_too_large', 'This request is too large.');
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw fault(400, 'invalid_json', 'Send a valid JSON object.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) throw fault(400, 'unexpected_fields', 'This action contains unsupported fields. Prices and payment status are owned by the server.');
  return body;
}

export async function createApp({ service, paypal, origin = 'http://127.0.0.1:4310', key = randomBytes(32) } = {}) {
  const originURL = new URL(origin);
  if (originURL.hostname !== '127.0.0.1' || originURL.protocol !== 'http:' || originURL.pathname !== '/') throw new Error('Only HTTP loopback origin is supported.');
  const mac = value => createHmac('sha256', key).update(value).digest('hex');
  const csrf = id => mac(`csrf:${id}`);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (status, value) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.host !== originURL.host) throw fault(403, 'invalid_host', 'Open this demo through its loopback URL.');
      let url;
      try { url = new URL(req.url, origin); } catch { throw fault(400, 'invalid_url', 'Invalid URL.'); }
      if (url.origin !== origin) throw fault(400, 'invalid_url', 'Invalid request origin.');
      const path = url.pathname;
      const token = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      const [candidate, signature] = (token || '').split('.');
      const validSession = /^[a-f0-9-]{36}$/.test(candidate || '') && safeEqual(signature, mac(`session:${candidate}`));
      const sessionId = validSession ? candidate : randomUUID();
      if (!validSession) res.setHeader('Set-Cookie', `${COOKIE}=${sessionId}.${mac(`session:${sessionId}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
      if (req.method === 'POST') {
        if (!validSession || req.headers.origin !== origin || !safeEqual(req.headers['x-csrf-token'], csrf(sessionId))) throw fault(403, 'invalid_csrf', 'Refresh the page before taking this action.');
      }
      if (req.method === 'GET' && path === '/api/config') return send(200, { brand, csrfToken: csrf(sessionId), paypal: { configured: Boolean(paypal?.configured), mode: 'sandbox', message: paypal?.configured ? 'PayPal sandbox only. Buyer approval and server capture are required.' : 'PayPal sandbox checkout is disabled. Secure sandbox credentials and approval are required.' }, model: { name: modelName } });
      if (req.method === 'GET' && path === '/api/listings') return send(200, { listings: await service.getListings() });
      const listing = path.match(/^\/api\/listings\/([a-z0-9-]+)$/);
      if (req.method === 'GET' && listing) return send(200, { listing: await service.getListing(listing[1]) });
      if (req.method === 'POST' && path === '/api/reviews') return send(201, { review: await service.createReview(sessionId, await bodyJSON(req, ['listingId', 'requirements'])) });
      const review = path.match(/^\/api\/reviews\/([a-zA-Z0-9-]+)(\/confirm)?$/);
      if (review && req.method === 'GET' && !review[2]) return send(200, { review: await service.getReview(sessionId, review[1]) });
      if (review && req.method === 'POST' && review[2]) return send(200, { review: await service.confirmReview(sessionId, review[1], await bodyJSON(req, ['acknowledged'])) });
      if (req.method === 'POST' && path === '/api/orders') return send(200, { order: await service.createOrder(sessionId, await bodyJSON(req, ['reviewId'])) });
      const order = path.match(/^\/api\/orders\/([a-zA-Z0-9-]+)(?:\/(capture|reconcile|cancel))?$/);
      if (order && req.method === 'GET' && !order[2]) return send(200, { order: await service.getOrder(sessionId, order[1]) });
      if (order && req.method === 'POST' && order[2]) {
        await bodyJSON(req, []);
        const method = { capture: 'captureOrder', reconcile: 'reconcileOrder', cancel: 'cancelOrder' }[order[2]];
        return send(200, { order: await service[method](sessionId, order[1]) });
      }
      const edit = path.match(/^\/api\/merchant\/listings\/([a-z0-9-]+)$/);
      if (edit && req.method === 'POST') return send(200, { listing: await service.editListing(sessionId, edit[1], await bodyJSON(req, ['description', 'priceCents', 'expectedVersion'])) });
      if (path.startsWith('/api/')) throw fault(404, 'not_found', 'This resource or action is unavailable.');
      if (req.method !== 'GET' && req.method !== 'HEAD') throw fault(405, 'method_not_allowed', 'This action is unavailable.');
      let staticPath;
      try { staticPath = decodeURIComponent(path === '/' ? '/index.html' : path); } catch { throw fault(400, 'invalid_url', 'Invalid path.'); }
      if (!/^\/[a-zA-Z0-9_./-]+$/.test(staticPath) || staticPath.split('/').some(segment => segment === '..' || segment.startsWith('.'))) throw fault(404, 'not_found', 'File unavailable.');
      const target = resolve(publicRoot, `.${staticPath}`);
      if (!target.startsWith(`${publicRoot}\\`) && !target.startsWith(`${publicRoot}/`)) throw fault(404, 'not_found', 'File unavailable.');
      if (!MIME[extname(target)]) throw fault(404, 'not_found', 'File unavailable.');
      let bytes;
      try { bytes = await readFile(target); } catch { throw fault(404, 'not_found', 'File unavailable.'); }
      res.setHeader('Content-Type', MIME[extname(target)]);
      res.setHeader('Cache-Control', 'no-store');
      res.statusCode = 200;
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 500;
      send(status, { error: { code: status === 500 ? 'server_error' : error.code || 'request_failed', message: status === 500 ? 'The local server could not complete this action. Refresh and try again.' : error.message } });
    }
  });
  server.requestTimeout = 180000;
  server.headersTimeout = 15000;
  return server;
}

export async function startLocalServer({ port = Number(process.env.PORT || 4310), dataDir = resolve(projectRoot, '.data') } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be an integer from 1024 to 65535.');
  const origin = `http://127.0.0.1:${port}`;
  const key = await loadKey(dataDir);
  const store = createStore(resolve(dataDir, 'second-look.sqlite'), initialListings);
  let server;
  try {
    // Existing credentials are not inspected during a disabled build/test run.
    const enabled = process.env.PAYPAL_SANDBOX_ENABLED === 'true';
    const paypal = createPayPal({ clientId: enabled ? process.env.PAYPAL_CLIENT_ID || '' : '', clientSecret: enabled ? process.env.PAYPAL_CLIENT_SECRET || '' : '', origin });
    const service = createService({ store, evidence: analyzeListing, paypal, origin });
    server = await createApp({ service, paypal, origin, key });
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolveListen); });
    console.log(`${brand.name}: ${origin} | PayPal sandbox ${paypal.configured ? 'configured' : 'disabled'} | Qwen on loopback only`);
    return { server, store, service, close: () => new Promise(done => server.close(() => { store.close(); done(); })) };
  } catch (error) {
    // Failed startup must release SQLite handles, including on Windows.
    if (server?.listening) await new Promise(done => server.close(done));
    store.close();
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const running = await startLocalServer();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await running.close(); process.exit(0); });
}
