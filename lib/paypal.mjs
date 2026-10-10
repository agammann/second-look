const API = 'https://api-m.sandbox.paypal.com';
const ID = /^[A-Z0-9]{1,36}$/;
const UUID = /^[a-f0-9-]{36}$/i;

export class PayPalError extends Error {
  constructor(code, { ambiguous = false, httpStatus = 503 } = {}) {
    super('PayPal sandbox could not complete this request.');
    this.name = 'PayPalError'; this.code = code; this.ambiguous = ambiguous; this.httpStatus = httpStatus;
  }
}

export function sandboxApprovalUrl(value, paypalId) {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.sandbox.paypal.com' && url.pathname === '/checkoutnow'
      && !url.username && !url.password && url.searchParams.get('token') === paypalId ? url.href : null;
  } catch { return null; }
}

/** Sandbox-only Orders v2 redirect adapter. Does not read environment/secrets.
 * The caller explicitly passes configuration. No network is used at construction.
 * Every request has a deadline and response limit; provider/payer data is never logged.
 */
export function createPayPal({ clientId, clientSecret, origin, fetchImpl = fetch, timeoutMs = 12_000 } = {}) {
  const local = new URL(origin ?? 'http://127.0.0.1:4310');
  if (local.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(local.hostname)
    || local.username || local.password || local.pathname !== '/' || local.search || local.hash) {
    throw new Error('PayPal return origin must be an HTTP loopback origin.');
  }
  const configured = Boolean(typeof clientId === 'string' && clientId.trim() && typeof clientSecret === 'string' && clientSecret.trim());
  let token = null;
  let tokenExpires = 0;
  let tokenPromise = null;
  async function request(path, init, sideEffect = false) {
    const signal = AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, 12_000)));
    try {
      const response = await fetchImpl(`${API}${path}`, { ...init, redirect: 'error', signal });
      const reader = response.body?.getReader();
      let body;
      if (reader) {
        const chunks = []; let length = 0;
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 128_000) { await reader.cancel(); throw new PayPalError('PROVIDER_INVALID', { ambiguous: sideEffect }); }
          chunks.push(part.value);
        }
        body = Buffer.concat(chunks).toString('utf8');
      } else body = await response.text();
      if (body.length > 128_000) throw new PayPalError('PROVIDER_INVALID', { ambiguous: sideEffect });
      if (!response.ok) throw new PayPalError('PROVIDER_REJECTED', { ambiguous: sideEffect && (response.status >= 500 || response.status === 408 || response.status === 429), httpStatus: response.status });
      let data;
      try { data = JSON.parse(body); } catch { throw new PayPalError('PROVIDER_INVALID', { ambiguous: sideEffect }); }
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PayPalError('PROVIDER_INVALID', { ambiguous: sideEffect });
      return data;
    } catch (error) {
      if (error instanceof PayPalError) throw error;
      throw new PayPalError('PROVIDER_UNAVAILABLE', { ambiguous: sideEffect });
    }
  }
  async function accessToken() {
    if (!configured) throw new PayPalError('PAYPAL_DISABLED');
    if (token && Date.now() < tokenExpires) return token;
    if (!tokenPromise) tokenPromise = (async () => {
      const data = await request('/v1/oauth2/token', {
        method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
      });
      if (typeof data.access_token !== 'string' || data.token_type !== 'Bearer' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new PayPalError('PROVIDER_INVALID');
      token = data.access_token; tokenExpires = Date.now() + Math.max(0, data.expires_in - 60) * 1000;
      return token;
    })().finally(() => { tokenPromise = null; });
    return tokenPromise;
  }
  async function api(path, method, body, requestId) {
    if (method === 'POST' && !UUID.test(requestId ?? '')) throw new Error('A persisted request UUID is required.');
    const bearer = await accessToken();
    return request(path, { method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(requestId ? { 'PayPal-Request-Id': requestId } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }, method === 'POST');
  }
  return {
    configured, mode: 'sandbox',
    message: configured ? 'PayPal sandbox configured. Only test accounts and test money.' : 'Sandbox checkout is disabled. Secure setup and user approval are required before any PayPal action.',
    async createOrder(order, requestId) {
      if (!Number.isSafeInteger(order.amountCents) || order.amountCents <= 0 || order.currency !== 'USD') throw new Error('Invalid server-owned amount.');
      const back = (state) => `${local.origin}/?checkout=${state}&order=${encodeURIComponent(order.id)}`;
      return api('/v2/checkout/orders', 'POST', {
        intent: 'CAPTURE', purchase_units: [{ reference_id: order.id, custom_id: order.id,
          amount: { currency_code: order.currency, value: (order.amountCents / 100).toFixed(2) }, description: 'Synthetic collectible — sandbox demonstration' }],
        payment_source: { paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: back('return'), cancel_url: back('cancel') } } },
      }, requestId);
    },
    getOrder(id) {
      if (!ID.test(id ?? '')) throw new PayPalError('PROVIDER_INVALID');
      return api(`/v2/checkout/orders/${id}`, 'GET');
    },
    captureOrder(id, requestId) {
      if (!ID.test(id ?? '')) throw new PayPalError('PROVIDER_INVALID');
      return api(`/v2/checkout/orders/${id}/capture`, 'POST', {}, requestId);
    },
  };
}
