# V4 focused browser QA preparation

Preparation snapshot: harness syntax checks passed without service, inference or browser startup. Root subsequently executed the rendered tests and cleanup; see [QA.md](QA.md) for completed results and [ROUTE.md](ROUTE.md) for the supported route.

V3 harness, fixture and server-helper snapshots are preserved under artifacts/browser/frozen-v3. The active harness writes separate artifacts/browser/v4 records and per-attempt screenshots, guards freeze-v4.json/source SHA-256 for natural runs and requires v4 actual Qwen responses. Six-suggestion assertions apply only to v4 analyses; older saved formats retain their prior interpretation.

The labeled MOCK suite retains quote/context, source-failure, legacy, keyboard/draft, stale/fresh decision and disabled-checkout checks. Three focused fixtures exercise six v4 quotes displayed, seven v4 quotes withheld, and four saved-v3 quotes withheld. One six-quote PNG is added. Fixtures remain visibly MOCK with no model/provider calls or completed payment fixture.

Commands for root's existing approved Chromium sandbox-enabled local route:

```
node scripts/start-browser-qa-server.mjs
node scripts/browser-check.mjs --isolated-qa --mock-ui --merchant-edit
# Only after v4 freeze and exclusive coordinated Qwen use:
node scripts/browser-check.mjs --isolated-qa --merchant-edit
```

The helper binds only 127.0.0.1:4322, disables PayPal without reading .env, creates owned-v4 temporary data and removes only its exact verified path after stdin stop. Root owns model cleanup. Real PayPal sandbox remains unconfigured/unverified.
