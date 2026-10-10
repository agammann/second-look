import { randomUUID } from 'node:crypto';
import { sandboxApprovalUrl } from './paypal.mjs';

export class ServiceError extends Error {
  constructor(status, code, message) { super(message); this.name = 'ServiceError'; this.status = status; this.statusCode = status; this.code = code; }
}
const fail = (status, code, message) => { throw new ServiceError(status, code, message); };
const now = () => new Date().toISOString();
const copy = (value) => structuredClone(value);
const exact = (body, keys) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !keys.includes(key))) fail(400, 'INVALID_INPUT', 'Unexpected request fields.');
};
const session = (id) => { if (typeof id !== 'string' || id.length < 16 || id.length > 128) fail(400, 'INVALID_SESSION', 'A valid browser session is required.'); };
const amountMatches = (amount, order) => amount?.currency_code === order.currency && amount.value === (order.amountCents / 100).toFixed(2);

/** Strictly validate provider evidence, not browser callbacks. One server-owned
 * purchase unit and one final capture are required; extra/partial captures fail.
 */
export function inspectPayPalOrder(order, data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !/^[A-Z0-9]{1,36}$/.test(data.id ?? '')
    || (order.paypalOrderId && data.id !== order.paypalOrderId) || (data.intent !== undefined && data.intent !== 'CAPTURE')
    || !['CREATED', 'SAVED', 'APPROVED', 'COMPLETED', 'VOIDED', 'PAYER_ACTION_REQUIRED'].includes(data.status)
    || !Array.isArray(data.purchase_units) || data.purchase_units.length !== 1) return null;
  const unit = data.purchase_units[0];
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)
    || (unit.payments !== undefined && (!unit.payments || typeof unit.payments !== 'object' || Array.isArray(unit.payments)))) return null;
  if ((unit.payments?.authorizations !== undefined && !Array.isArray(unit.payments.authorizations))
    || (unit.payments?.captures !== undefined && !Array.isArray(unit.payments.captures))) return null;
  if (unit.reference_id !== order.id || (unit.custom_id !== undefined && unit.custom_id !== order.id)
    || (unit.amount !== undefined && !amountMatches(unit.amount, order)) || (unit.payments?.authorizations?.length ?? 0) !== 0) return null;
  const captures = unit.payments?.captures ?? [];
  if (!Array.isArray(captures) || captures.length > 1) return null;
  const capture = captures[0];
  if (captures.length && (!capture || typeof capture !== 'object' || Array.isArray(capture))) return null;
  if (!capture) return data.status === 'COMPLETED' || !amountMatches(unit.amount, order) ? null : { providerOrderStatus: data.status, captureStatus: null, captureId: null, status: data.status === 'VOIDED' ? 'failed' : 'awaiting_approval' };
  if (!/^[A-Z0-9]{1,36}$/.test(capture.id ?? '') || !amountMatches(capture.amount, order)
    || capture.final_capture !== true || !['COMPLETED', 'PENDING', 'DECLINED', 'FAILED', 'DENIED', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(capture.status)) return null;
  const status = capture.status === 'COMPLETED' && data.status === 'COMPLETED' ? 'completed'
    : capture.status === 'PENDING' ? 'pending'
    : ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(capture.status) ? 'refunded'
    : ['DECLINED', 'FAILED', 'DENIED'].includes(capture.status) ? 'failed' : 'ambiguous';
  return { providerOrderStatus: data.status, captureStatus: capture.status, captureId: capture.id, status };
}

/** Session-owned API, matching CONTRACT.md. Reads are synchronous. Mutations are
 * async and use persisted listing leases spanning provider calls. Only the HTTP
 * layer's signed, CSRF-protected session may be supplied as sessionId.
 */
export function createService({ store, evidence, paypal, origin }) {
  if (!store || typeof evidence !== 'function' || !paypal || !origin) throw new Error('Service dependencies are required.');
  const inFlight = new Map();
  function once(key, fn) {
    if (inFlight.has(key)) return inFlight.get(key);
    const operation = Promise.resolve().then(fn).finally(() => inFlight.delete(key));
    inFlight.set(key, operation); return operation;
  }
  function owned(getter, sessionId, id) {
    session(sessionId);
    const value = getter(id);
    if (!value || value.sessionId !== sessionId) fail(404, 'NOT_FOUND', 'This resource is unavailable in this browser session.');
    return value;
  }
  const stale = (value) => store.listing(value.listingId)?.version !== (value.listingVersion ?? value.snapshot.version);
  function publicReview(review) {
    const { sessionId, ...value } = review; return copy({ ...value, stale: stale(review) });
  }
  function publicOrder(order) {
    const { sessionId, createRequestId, captureRequestId, createStartedAt, captureAttemptedAt, ...value } = order;
    return copy({ ...value, stale: stale(order), approvalUrl: stale(order) || ['cancelled', 'stale', 'failed', 'completed', 'pending', 'ambiguous', 'refunded'].includes(order.status) ? null : order.approvalUrl });
  }
  function fresh(value) {
    if (stale(value)) fail(409, 'STALE_REVIEW', 'The merchant changed this listing. Review the new description and price, then approve a new checkout.');
  }
  function configured() {
    if (!paypal.configured) fail(503, 'PAYPAL_DISABLED', 'PayPal sandbox checkout is disabled. Secure setup and user approval are required.');
  }
  async function locked(listingId, fn) {
    const owner = randomUUID();
    if (!store.acquireLease(listingId, owner)) fail(409, 'LISTING_BUSY', 'A listing operation is still running. Wait for its result before trying again.');
    const commit = (action) => store.transaction(() => {
      if (!store.assertLease(listingId, owner)) fail(409, 'OPERATION_EXPIRED', 'This operation expired. Check the saved payment status before continuing.');
      return action();
    });
    try { return await fn(commit); } finally { store.releaseLease(listingId, owner); }
  }
  function save(order, patch, commit) {
    const candidate = { ...order, ...patch, updatedAt: now() };
    commit(() => store.saveOrder(candidate));
    Object.assign(order, candidate);
    return order;
  }
  function uncertain(order, commit, message = 'PayPal status could not be verified. Payment may have completed. Check status; do not start another purchase.') {
    const verified = Boolean(order.captureId && ['completed', 'pending', 'failed', 'refunded'].includes(order.status));
    return save(order, { status: verified ? order.status : 'ambiguous', message, verificationIssue: true }, commit);
  }
  function applyProvider(order, data, commit) {
    const observation = inspectPayPalOrder(order, data);
    if (!observation) return uncertain(order, commit, 'PayPal returned unsupported or mismatched payment details. No completed payment is verified. Check status before continuing.');
    if (order.captureId && observation.captureId && order.captureId !== observation.captureId) return uncertain(order, commit, 'PayPal returned a different capture identifier. Payment details require review.');
    // Never erase an established capture just because a later provider response omits it.
    if (order.captureId && !observation.captureId) return uncertain(order, commit, 'PayPal did not return the previously verified capture. The last verified status is preserved.');
    if (!observation.captureId && order.captureRequestId) {
      return save(order, { providerOrderStatus: observation.providerOrderStatus, status: 'ambiguous', lastCheckedAt: now(), message: 'Capture was requested, but PayPal has not supplied a capture result. Payment may have completed. Check status again before any further purchase.' }, commit);
    }
    let status = observation.status;
    if (!observation.captureId && ['cancelled', 'stale'].includes(order.status)) status = order.status;
    const messages = {
      completed: 'PayPal sandbox verified a completed capture. This is test money; seller statements remain unverified.',
      pending: 'PayPal reports a pending capture. Payment is not completed. Check status later.',
      failed: 'PayPal reports a failed or declined payment. No completed capture is verified.',
      refunded: 'PayPal reports the capture was refunded or partially refunded.',
      ambiguous: 'PayPal returned a capture whose completion could not be verified. Check status before any further purchase.',
      awaiting_approval: observation.providerOrderStatus === 'APPROVED' ? 'Buyer approval is verified by PayPal. Use the explicit capture action to finish this sandbox checkout.' : 'Awaiting buyer approval in PayPal sandbox. Returning to this page does not prove payment.',
      cancelled: 'Checkout was cancelled locally before any capture request. No payment was initiated by this app.',
      stale: 'The listing changed. A fresh evidence review and PayPal approval are required.',
    };
    try {
      return save(order, { ...observation, status, lastCheckedAt: now(), message: messages[status], verificationIssue: false }, commit);
    } catch (error) {
      if (error.code?.startsWith('ERR_SQLITE') && /UNIQUE/.test(error.message)) return uncertain(order, commit, 'This provider capture or order identifier is already recorded for another checkout. No new completion is verified.');
      throw error;
    }
  }
  async function reconcileLocked(order, commit) {
    if (!order.paypalOrderId) return uncertain(order, commit, 'The sandbox create response was not received. No capture was requested. A retry must reuse the saved create request ID.');
    try { return applyProvider(order, await paypal.getOrder(order.paypalOrderId), commit); }
    catch (error) {
      if (error instanceof ServiceError) throw error;
      return uncertain(order, commit);
    }
  }
  return {
    getListings: () => copy(store.listings()),
    getListing(id) {
      const item = store.listing(id); if (!item) fail(404, 'NOT_FOUND', 'This listing is unavailable.'); return copy(item);
    },
    async createReview(sessionId, body) {
      session(sessionId); exact(body, ['listingId', 'requirements']);
      const { listingId, requirements } = body;
      if (typeof listingId !== 'string' || !Array.isArray(requirements) || requirements.length < 1 || requirements.length > 3
        || requirements.some((value) => typeof value !== 'string' || !value.trim() || value.length > 160)) fail(400, 'INVALID_INPUT', 'Provide one to three requirements of at most 160 characters each.');
      const listing = store.listing(listingId); if (!listing) fail(404, 'NOT_FOUND', 'This listing is unavailable.');
      const normalized = requirements.map((value) => value.trim());
      let analysis;
      try { analysis = await evidence({ description: listing.description, requirements: normalized }); }
      catch { analysis = { kind: 'quote-suggestions', sourceDigest: null, sourceSpans: [], notices: [],
        results: normalized.map((requirement) => ({ requirement, suggestions: [], questions: [], validation: 'unavailable', reason: 'Local suggestions unavailable. Read the full seller text and decide yourself.' })),
        model: 'qwen3.5:4b-q4_K_M', durationMs: 0 }; }
      const review = { id: randomUUID(), sessionId, listingId, listingVersion: listing.version, snapshot: listing, requirements: normalized, analysis, confirmedAt: null, createdAt: now() };
      store.transaction(() => store.saveReview(review)); return publicReview(review);
    },
    getReview(sessionId, id) { return publicReview(owned(store.review, sessionId, id)); },
    async confirmReview(sessionId, id, body) {
      exact(body, ['acknowledged']); if (body.acknowledged !== true) fail(400, 'REVIEW_REQUIRED', 'Explicitly acknowledge the seller statements and visible uncertainty.');
      const review = owned(store.review, sessionId, id);
      return locked(review.listingId, async (commit) => {
        fresh(review); review.confirmedAt ??= now(); commit(() => store.saveReview(review)); return publicReview(review);
      });
    },
    async createOrder(sessionId, body) {
      session(sessionId); exact(body, ['reviewId']); if (typeof body.reviewId !== 'string') fail(400, 'INVALID_INPUT', 'A confirmed review is required.');
      const review = owned(store.review, sessionId, body.reviewId);
      return once(`create:${sessionId}:${review.id}`, () => locked(review.listingId, async (commit) => {
        let order = store.orderForReview(review.id);
        if (order && ['completed', 'pending', 'refunded', 'failed', 'cancelled'].includes(order.status)) return publicOrder(order);
        fresh(review); if (!review.confirmedAt) fail(409, 'REVIEW_REQUIRED', 'Review the evidence and explicitly confirm before checkout.');
        const unresolved = store.ordersForListing(review.listingId).find((existing) => existing.sessionId === sessionId && existing.id !== order?.id
          && existing.captureRequestId && ['capture_in_progress', 'pending', 'ambiguous'].includes(existing.status));
        if (unresolved) fail(409, 'PAYMENT_UNRESOLVED', 'An earlier capture for this item is pending or unknown. Check that saved checkout before starting another purchase.');
        configured();
        if (order?.paypalOrderId || order?.captureRequestId) return publicOrder(order);
        if (order && Date.now() - Date.parse(order.createStartedAt) > 6 * 60 * 60 * 1000) fail(409, 'RETRY_EXPIRED', 'The safe create retry window expired. Do not start a duplicate purchase; review this checkout first.');
        if (!order) {
          order = { id: randomUUID(), sessionId, reviewId: review.id, listingId: review.listingId, status: 'creating', provider: 'paypal-sandbox', paypalOrderId: null, captureId: null,
            amountCents: review.snapshot.priceCents, currency: review.snapshot.currency, snapshot: review.snapshot, requirements: review.requirements, analysis: review.analysis,
            createdAt: now(), updatedAt: now(), approvalUrl: null, message: 'Creating the sandbox approval request.', createRequestId: randomUUID(), createStartedAt: now(), captureRequestId: null, captureAttemptedAt: null, providerOrderStatus: null, captureStatus: null, lastCheckedAt: null, verificationIssue: false };
        }
        save(order, { status: 'creating' }, commit); // durable ID before provider POST
        let response;
        try { response = await paypal.createOrder(copy(order), order.createRequestId); }
        catch (error) {
          return publicOrder(save(order, { status: error.ambiguous === false ? 'failed' : 'ambiguous', message: error.ambiguous === false ? 'PayPal rejected the sandbox order. No capture was requested.' : 'The sandbox order creation outcome is unknown. No capture was requested. Retry only this saved checkout, using its persistent request ID.' }, commit));
        }
        if (!/^[A-Z0-9]{1,36}$/.test(response?.id ?? '')) return publicOrder(uncertain(order, commit, 'PayPal returned an invalid order identifier. No capture was requested.'));
        try { save(order, { paypalOrderId: response.id }, commit); }
        catch (error) {
          if (error.code?.startsWith('ERR_SQLITE') && /UNIQUE/.test(error.message)) return publicOrder(uncertain(order, commit, 'This PayPal order identifier is already recorded for another checkout. No new payment is verified.'));
          throw error;
        }
        // Current PayPal wallet create responses may contain only ID/status and
        // payer-action links, even with return=representation. Read the resource
        // to verify its saved reference and amount before offering approval.
        if (inspectPayPalOrder(order, response)) applyProvider(order, response, commit);
        else await reconcileLocked(order, commit);
        if (order.status === 'awaiting_approval') {
          const url = Array.isArray(response.links) ? response.links
            .filter((link) => link && typeof link === 'object' && (link.rel === 'approve' || link.rel === 'payer-action'))
            .map((link) => sandboxApprovalUrl(link.href, order.paypalOrderId)).find(Boolean) : null;
          if (!url) uncertain(order, commit, 'PayPal did not return a valid sandbox approval URL. No capture was requested.');
          else save(order, { approvalUrl: url }, commit);
        }
        return publicOrder(order);
      }));
    },
    getOrder(sessionId, id) { return publicOrder(owned(store.order, sessionId, id)); },
    async captureOrder(sessionId, id) {
      const initial = owned(store.order, sessionId, id);
      return once(`capture:${sessionId}:${id}`, () => locked(initial.listingId, async (commit) => {
        const order = owned(store.order, sessionId, id);
        if (['completed', 'pending', 'failed', 'refunded', 'cancelled'].includes(order.status)) return publicOrder(order);
        configured();
        // Ambiguous capture is read-only on repetition. Never blindly re-POST.
        if (order.captureRequestId) return publicOrder(await reconcileLocked(order, commit));
        fresh(order); const review = owned(store.review, sessionId, order.reviewId); fresh(review);
        if (!review.confirmedAt) fail(409, 'REVIEW_REQUIRED', 'Explicit evidence review is required before capture.');
        if (!order.paypalOrderId) fail(409, 'ORDER_UNAVAILABLE', 'A verified sandbox approval order is required.');
        await reconcileLocked(order, commit);
        if (order.status !== 'awaiting_approval' || order.providerOrderStatus !== 'APPROVED') return publicOrder(order);
        fresh(order);
        save(order, { status: 'capture_in_progress', captureRequestId: randomUUID(), captureAttemptedAt: now(), approvalUrl: null, message: 'Capture requested. Wait for the verified provider result.' }, commit);
        try { applyProvider(order, await paypal.captureOrder(order.paypalOrderId, order.captureRequestId), commit); }
        catch (error) {
          if (error instanceof ServiceError) throw error;
          uncertain(order, commit);
          await reconcileLocked(order, commit);
        }
        return publicOrder(order);
      }));
    },
    async reconcileOrder(sessionId, id) {
      const order = owned(store.order, sessionId, id); configured();
      return once(`reconcile:${sessionId}:${id}`, () => locked(order.listingId, async (commit) => publicOrder(await reconcileLocked(owned(store.order, sessionId, id), commit))));
    },
    async cancelOrder(sessionId, id) {
      const initial = owned(store.order, sessionId, id);
      // A back/cancel callback cannot hide any possible or established capture.
      if (initial.captureRequestId || ['creating', 'capture_in_progress', 'completed', 'pending', 'ambiguous', 'failed', 'refunded'].includes(initial.status)) return publicOrder(initial);
      return locked(initial.listingId, async (commit) => {
        const order = owned(store.order, sessionId, id);
        if (!order.captureRequestId && !['completed', 'pending', 'ambiguous', 'failed', 'refunded'].includes(order.status)) save(order, { status: stale(order) ? 'stale' : 'cancelled', approvalUrl: null, message: 'Checkout was cancelled locally before any capture request. No payment was initiated by this app.' }, commit);
        return publicOrder(order);
      });
    },
    async editListing(sessionId, id, body) {
      session(sessionId); exact(body, ['description', 'priceCents', 'expectedVersion']);
      if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 2400
        || !Number.isSafeInteger(body.priceCents) || body.priceCents < 100 || body.priceCents > 100_000
        || !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) fail(400, 'INVALID_INPUT', 'Provide a seller description, a price from $1 to $1,000, and the expected listing version.');
      return locked(id, async (commit) => commit(() => {
        const listing = store.listing(id); if (!listing) fail(404, 'NOT_FOUND', 'This listing is unavailable.');
        if (listing.version !== body.expectedVersion) fail(409, 'STALE_LISTING', 'The listing was already edited. Load its current version.');
        if (listing.description === body.description.trim() && listing.priceCents === body.priceCents) return copy(listing);
        Object.assign(listing, { description: body.description.trim(), priceCents: body.priceCents, version: listing.version + 1 });
        store.saveListing(listing);
        for (const order of store.ordersForListing(id)) {
          if (!order.captureRequestId && ['awaiting_approval', 'creating', 'ambiguous'].includes(order.status)) {
            Object.assign(order, { status: 'stale', approvalUrl: null, updatedAt: now(), message: 'The listing changed. A fresh evidence review and PayPal approval are required.' }); store.saveOrder(order);
          }
        }
        return copy(listing);
      }));
    },
  };
}
