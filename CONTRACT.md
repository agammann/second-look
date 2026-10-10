# Module and API contract

Repository root is this task workspace. ESM, Node >=24.2. Root owns integration/docs. Evidence agent owns `lib/evidence.mjs`, `tests/evidence.test.mjs`, `tests/fixtures/`, `scripts/check-model.mjs`. Backend agent owns `lib/store.mjs`, `lib/paypal.mjs`, `lib/service.mjs`, `tests/payments.test.mjs`. UI agent owns `public/`. Root owns `server.mjs`, `lib/catalog.mjs`, `lib/brand.mjs`, HTTP integration tests and docs.

## Evidence module

Quote-first v4: `analyzeListing({description, requirements}, options={})` async returns `{kind:'quote-suggestions',results:[{requirement,suggestions:[{spanId,quote}],questions:[{id,text}],validation:'valid'|'invalid'|'unavailable'|'untrusted',reason:string}], sourceDigest:string,sourceSpans:[{id,start,end,text,eligible,excludedReason?}],model:string,evidenceVersion:string,notices:string[],durationMs:number}`. `options.fetchImpl`, `options.endpoint`, `options.timeoutMs` are injectable for tests. Up to 3 nonempty requirements, max 160 chars each; description max 2400 chars. Ollama endpoint stays loopback with fixed `qwen3.5:4b-q4_K_M`, context 4096, bounded output, timeout and no tools. Requirements come from server input, never model output. No runtime startup/unload by module.

The model selects at most six server-owned eligible source span IDs and at most two fixed neutral question IDs per complete requirement in one bounded call. Historical v3 retains its three-span bound. The server maps them back to exact immutable description spans and controlled question text; it does not accept model-generated quotes, invented question premises or buying verdicts. Mechanical validity only means those IDs and quotations belong to the reviewed source. Relevance, coverage, completeness, authenticity and truth are unverified. Full saved seller context remains visible for human interpretation. Unknown/excluded IDs, malformed rows and unavailable output have an honest empty-suggestion state. Questions are optional and make no asserted factual premise. Shared source eligibility excludes detected instructions/general decision claims from suggestions; full seller text is still untrusted context. The preserved historical v1/v2 schemas, empty-unknown/context policies and frozen results remain under `artifacts/model-check/v1/` and `v2/`; clients do not relabel them v3 or present their verdicts as buying advice.

## Store/service

`createStore(path, initialListings)` returns store. `createService({store, evidence:analyzeListing, paypal, origin})` returns methods as defined by backend. Export errors with HTTP status/code/message. Service result JSON shape below. Keep service API documented in source. Root HTTP forwards sessionId to all methods.

Listing shape: `{id,title,subtitle,description,priceCents,currency:'USD',version:1,art:'orbit'|'moss'|'tide'|'atlas'|'lumen'|'kite'}`.
Review shape: `{id,listingId,listingVersion,snapshot:Listing,requirements:[],analysis:{kind,results,sourceDigest,sourceSpans,model,evidenceVersion,notices:[],durationMs},confirmedAt:null|string,createdAt,stale:boolean}`. Analysis is stored unchanged. A caught engine failure has kind `quote-suggestions`, empty suggestions/questions, `validation:'unavailable'`, no source digest or spans, and no claimed evidence version. Historical saved analyses may omit these fields; clients preserve that absence and render a historical reading view without automated verdicts or advice.
Order shape: `{id,reviewId,listingId,status,provider:'paypal-sandbox',paypalOrderId:null|string,captureId:null|string,amountCents,currency,snapshot:Listing,requirements:[],analysis,createdAt,updatedAt,approvalUrl:null|string,message:string,providerOrderStatus:null|string,captureStatus:null|string,lastCheckedAt:null|string,verificationIssue:boolean,stale:boolean}`. Only actual COMPLETED verified capture sets local status `completed`. Provider order status and capture status remain separate; `verificationIssue` marks an unresolved observation without manufacturing a paid state. Durable request IDs and internal operation timestamps are excluded from public responses. Mocks exist only in tests, no mock app payment mode.

## HTTP API (JSON)

GET `/api/config` -> `{brand:{name,merchant},csrfToken,paypal:{configured:boolean,mode:'sandbox',message},model:{name}}`; also sets HttpOnly SameSite=Lax session cookie.
GET `/api/listings` -> `{listings:[]}`
GET `/api/listings/:id` -> `{listing}`
POST `/api/reviews` `{listingId,requirements:[]}` -> `{review}`
GET `/api/reviews/:id` -> `{review}`
POST `/api/reviews/:id/confirm` `{acknowledged:true}` -> `{review}`
POST `/api/orders` `{reviewId}` -> `{order}`; repeated requests reuse persistent order/idempotency.
GET `/api/orders/:id` -> `{order}`; local state only
POST `/api/orders/:id/capture` `{}` -> `{order}`; explicit user action after PayPal return. Check provider approval server-side. Never trust token/callback status.
POST `/api/orders/:id/reconcile` `{}` -> `{order}`; read provider state without initiating purchase.
POST `/api/orders/:id/cancel` `{}` -> `{order}`; stale/terminal/in-flight capture must not be converted to cancelled.
POST `/api/merchant/listings/:id` `{description,priceCents,expectedVersion}` -> `{listing}`; local controlled demo editor, no seller onboarding.

All POSTs require `Content-Type: application/json`, `X-CSRF-Token`, exact same-origin Origin, session cookie and reject extra fields. Errors `{error:{code,message}}`. No client price/currency allowed on review/order routes. Status HTTP 409 for stale, 503 disabled/unavailable, 400 invalid, 404 unavailable resources. Loopback `127.0.0.1:4310` fixed default; request Host must be exact allowed origin host. Serve only public allowlist/static safe paths, no credentials or DB. `/` handles `?checkout=return|cancel&order=<internalId>` and `?review=<id>`. UI persists IDs via URL/sessionStorage, fetches snapshots after navigation.

## PayPal adapter

`createPayPal({clientId,clientSecret,origin,fetchImpl})` with `configured`, `createOrder(order, requestId)`, `getOrder(paypalId)`, `captureOrder(paypalId, requestId)`. Hardcoded API `https://api-m.sandbox.paypal.com`; redirects only `https://www.sandbox.paypal.com`. Credentials via process env or explicitly user-created `.env` only. DO NOT read existing secrets during build. Persist create/capture request IDs before any provider call. Redirect return/cancel URLs include internal order ID. Sandbox standard redirect Orders flow with CAPTURE intent and NO_SHIPPING. Provider failures produce generic safe errors; no credential/payer logging.
