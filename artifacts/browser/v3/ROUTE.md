# Quote-first browser QA route

Updated 2026-10-10 UTC. The Browser plugin/skill is absent. The frontend-testing-debugging skill permits regular Playwright in that case. The earlier single CUA probe failed with MXC HRESULT 0x80070003 and was not retried for v3. Historical restricted-context failures are retained in [the v2 route ledger](../frozen-v2/ROUTE.md).

The supported route uses existing Playwright 1.62.1 and installed matching Chromium headless shell 151.0.7922.34. Calls use narrowly scoped, auto-reviewed local execution approval. Every launch keeps `chromiumSandbox:true`. There was no browser/package download, sandbox-disable flag, denied permission bypass, public tunnel, firewall change, external binding, credential access or account action.

## Reproduction

Start `node scripts/start-browser-qa-server.mjs` in the approved local context. It imports the current module and creates fresh owned temporary SQLite data on `http://127.0.0.1:4322`, forcing PayPal disabled without reading .env. Send `stop` on its stdin to close only that server and remove only its exact verified real temporary path. Startup, cleanup and browser attempts have separate timestamped records.

- `node scripts/browser-check.mjs --isolated-qa --catalogue-only`: actual catalogue, config/listing GETs only, no inference/provider calls.
- `node scripts/browser-check.mjs --isolated-qa --mock-ui --merchant-edit`: clearly labeled browser-intercepted fixtures; no model, provider or real server mutation.
- `node scripts/browser-check.mjs --isolated-qa --merchant-edit`: natural live local-Qwen reviews and real synthetic merchant edit in owned temporary data. Obtain exclusive coordinated model use first. Restart the helper after freeze so Node imports frozen source. The script checks the frozen module SHA-256, v3 analysis kind/version, actual Qwen name and positive duration; no unavailable fallback can pass as live inference.

The natural flow under test is: catalogue -> listing -> three requirements -> quote suggestions/neutral questions/full saved seller context -> explicit buyer decision -> disabled checkout -> merchant description/price edit -> stale saved review -> distinct fresh review and new buyer decision.

Existing installation paths can be selected with PLAYWRIGHT_MODULE_PATH and CHROME_PATH. APP_ORIGIN is constrained to HTTP 127.0.0.1. No service starts automatically on login. Outputs are under artifacts/browser/v3, with immutable per-attempt screenshots in runs and convenient latest copies. Source/selection model evaluations remain separate from browser UI checks.

The strengthened MOCK suite passed 40/40 checks with zero console/page errors. The frozen-v3 natural flow passed 24/24 with two sequential actual Qwen reviews, a real synthetic merchant edit and a fresh explicit buyer decision. The actual read-only catalogue capture passed 6/6. No provider request occurred. Qwen was unloaded and residency verified empty before handback; both owned QA servers stopped and only their verified temporary data was removed. See [QA.md](QA.md) for raw records/screenshots and remaining gates. Real PayPal sandbox checkout is disabled and unverified.
