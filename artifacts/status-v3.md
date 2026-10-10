# Prototype handoff status

Updated 2026-10-10 UTC. **Quote-first local build tested and visually inspected. AI retrieval remains limited; real PayPal sandbox checkout is pending. Not hackathon ready.**

The standalone Node 24 project uses no runtime packages or build step. Six original synthetic boxed collectibles and original SVG art support a merchant-owned demo shop. The working title Second Look is centrally configurable and not name-cleared. Earlier projects, model weights and task-3 benchmark artifacts were not modified.

The approved v3 flow uses live local Qwen to select server-owned seller sentence IDs and optional neutral question IDs for each complete buyer requirement. The server maps accepted IDs to exact saved seller spans and fixed question text. The interface shows the full immutable listing and requires an independent human acknowledgement. There are no automated buying verdicts. Exact quotations establish source integrity only; relevance, important exclusions, component/variant scope, completeness, authenticity and truth are unverified. Invalid, excluded, empty or unavailable output is visible. Detected instructions are excluded from suggestions while the full untrusted seller text remains visible.

Payment and version controls are preserved: server-owned integer-cent prices, immutable reviews and receipt snapshots, explicit buyer review, persistent order IDs and idempotency, expected amount/currency/reference checks, duplicate/replay handling and stale approval protection. Merchant edits require a new review, human confirmation and separate sandbox buyer approval. The unavailable fallback now preserves full seller context with empty quote suggestions. Historical analyses retain their original data and render as a reading view without automated verdicts.

## Current validation

| Check | Result | Evidence |
|---|---|---|
| Complete deterministic suite | 139/139 passed: 64 current checks (20 evidence, 8 runner/mapping, 29 payment, 4 money, 3 HTTP-handler) and 75 preserved historical checks (72 evidence, 3 runner). Mocks are explicitly labeled | [test-results.txt](artifacts/test-results.txt) |
| Actual loopback HTTP | 5 checks passed: config, six listings, HTML, shared quote module and failed-listener SQLite cleanup; no model/provider calls | [http-live.json](artifacts/http-live.json) |
| Independent source audit | 26 additional mechanical mocked checks passed; frozen engine, exact input/gold isolation, first-run cleanup and historical preservation independently audited | [SOURCE-AUDIT.md](artifacts/model-check/v3/SOURCE-AUDIT.md) |
| V3 fresh live retrieval | 6 actual responses, 8/8 mechanically valid requirement rows, 14/14 exact source suggestions; adequate semantic coverage in 3/6 cases. Two partial cases and three irrelevant wardrobe rows remain failures. All 8 questions neutral but generic | [First raw run](artifacts/model-check/independent-quote-v3-first.json), [independent per-case assessment](artifacts/model-check/v3/SOURCE-AUDIT.md), [input provenance](artifacts/model-check/independent-quote-v3-input-provenance.json) |
| V3 MOCK browser | 40/40 passed, zero console/page errors, 22 screenshots; fixtures are explicitly mocked | [MOCK-report.json](artifacts/browser/v3/MOCK-report.json) |
| V3 natural browser | 24/24 passed, no console/page errors, two actual Qwen reviews, actual $48/v1 to $49/v2 merchant edit, stale snapshot and new human acknowledgement. Desktop/mobile pixels inspected | [Actual report](artifacts/browser/v3/report.json), [QA ledger](artifacts/browser/v3/QA.md), [desktop](artifacts/browser/v3/03-evidence-desktop.png), [mobile](artifacts/browser/v3/04-evidence-mobile.png) |
| Real PayPal sandbox | Disabled; no credentials read/entered, account actions or provider requests | [.env.example](.env.example), labeled adapter/service tests |

## Preserved history

V3 froze at `2026-10-10T01:46:26.096Z`, before any v3 inference and before the parent supplied its fresh six. [Freeze record](artifacts/model-check/freeze-v3.json) pins module/validator `97b5d56012cb40331ddd87f5b7af24d459cefe5c37aa25a5ff5c72fd4d66e130`, prompt `3249ce0fcdb46fbfd6c91e5ca341a43094f672e4938a8fbc9e95f352756b6e99`, and schema `332423f3c2bc795c51d5060d3d09caaf123a74dc48aef2afc31a77b5c80992bc`. No old model benchmark preceded the fresh run, and no prompt/source tuning or rerun followed it.

The first fresh run's human assessment found: lamp selected the important bulb exclusion but omitted arm/switch function; table retained both variants; bookcase retained old description, update and current shelf count; chairs retained quantity/unit/delivery but omitted no-other-charges; camera retained the missing cable without detected instruction text; wardrobe returned unrelated category/appearance/contact text instead of empty selections for all three missing facts. The chair case exceeded the frozen three-suggestion capacity; that remains a coverage failure. All questions came from fixed neutral templates and invented no factual premise, but most were weak or redundant. A separate fixture calculation gives 4 × $22 + $15 = $103, above $100; it is trusted-cent arithmetic, not an AI budget decision or app budget feature. [Arithmetic record](artifacts/model-check/v3/fresh-six-money.json).

The run used 434–478 prompt tokens and 21–60 output tokens, with stop termination for all six responses. First load took 3,717 ms; median request was 962.5 ms in this session. These small synthetic results do not establish reliable general retrieval. The fresh six are now exposed; future uses are regression checks. [Stats](artifacts/model-check/v3/first-six-stats.json), [reusable runner checks](artifacts/model-check/v3/RUNNER-CHECKS.md).

Frozen v1 delivered 4/12 labels and 1/12 full contracts on the first parent independent set, including one false contradiction. Frozen v2 delivered 2/8 labels and 1/8 full contracts on its fresh independent set, including one false contradiction. The v2 failure audit found both model interpretation errors and conservative validator rejections. These results motivated the approved quote-first redesign; they remain unchanged and are not relabeled as v3 retrieval results.

- [Frozen v1](artifacts/model-check/freeze-v1.json), [first independent audit](artifacts/model-check/INDEPENDENT-V1-RESULTS.md), [internal audit](artifacts/model-check/INTERNAL-RESULTS.md).
- [Frozen v2](artifacts/model-check/freeze-v2.json), [exposed regression audit](artifacts/model-check/EXPOSED-V2-RESULTS.md), [fresh independent audit](artifacts/model-check/INDEPENDENT-V2-RESULTS.md).
- The old delivered ZIP and metadata are preserved byte-for-byte under `deliveries/v2/`; archive SHA-256 is `c3557f6201d658c9cef335130b3aae9cd339120abd144ebe7df1e1f3d8b06a07`. Prior screenshots/reports are preserved under `artifacts/browser/frozen-v1/` and `frozen-v2/`.

Initial restricted HTTP/model access returned EACCES. CUA failed once with MXC HRESULT 0x80070003. The parent-authorized narrow execution review established actual loopback and existing Playwright/Chromium testing with Chromium's sandbox enabled. Failed attempts remain recorded. No tunnel, firewall/binding/security change, downloaded browser, paid resource, Docker startup or login startup change was used. [Browser route](artifacts/browser/ROUTE.md).

## Remaining gates

The local reading flow and browser mechanics are validated, but source integrity is insufficient to claim reliable retrieval. The fresh omissions, irrelevant selections and generic questions are unresolved limitations. Any later model improvement needs a new freeze and new independent cases; the preserved six must not be presented as fresh afterward.

For actual PayPal testing, the parent needs the user's explicit authorization to use sandbox merchant credentials and perform create/capture tests. The user supplies the sandbox client ID and secret securely through protected local setup, outside chat, source and screenshots, and enables `PAYPAL_SANDBOX_ENABLED=true`. The user separately signs in and approves with a sandbox buyer. Account creation, credential discovery and agreements were not performed. Actual sandbox capture, cancellation/failure recovery and receipt inspection remain required. External publication, registration and hackathon submission belong to the parent after applicable approval and rules review.

Owned browser servers and temporary databases were stopped/removed. Qwen was unloaded after both the fresh run and browser flow. The owned foreground Ollama runtime stopped after empty residency; loopback verification returned ECONNREFUSED. Model weights, prior benchmarks and normal demo state were preserved. [Cleanup record](artifacts/session-cleanup-v3.json).

The revised archive contains runnable code, tests, frozen source/raw outputs, screenshots, run guide, demo script and submission narrative. It excludes credentials, local SQLite/session state, runtimes, weights and the previous ZIP. Archive verification and confirmed Library delivery outcomes are recorded separately in `DELIVERY.json` and the final handoff. [README.md](README.md) provides run instructions; [LICENSE](LICENSE) covers original code/text/art and [NOTICES.md](NOTICES.md) records separate licenses.
