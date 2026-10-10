# Quote-first browser QA ledger

2026-10-10 UTC. Existing Playwright 1.62.1 / Chromium 151.0.7922.34, interactive headless automation with chromiumSandbox:true and narrowly scoped supported execution approval. [ROUTE.md](ROUTE.md) records reproduction; [SOURCE-QA.md](SOURCE-QA.md) records the source audit.

| Run | Outcome | Scope |
| --- | --- | --- |
| First v3 MOCK, 01:41:07-01:41:09 UTC | 16 checks passed, then one obsolete version-label assertion failed | Harness expected Listing version 1; new UI says Saved version 1. [Raw attempt](2026-10-10T01-41-07-749Z-MOCK-report.json). Screenshots preserved in that run directory. |
| V3 MOCK, 01:42:09-01:42:18 UTC | 40/40 pass, zero console/page errors, 22 PNGs | Browser-only fixture suite. [Raw attempt](2026-10-10T01-42-09-105Z-MOCK-report.json). |
| Actual catalogue, 01:43:40-01:43:41 UTC | 6/6 pass, zero errors, one PNG | Only GET /api/config and GET /api/listings. No inference/payment calls. [Report](CURRENT-report.json), [catalogue](CURRENT-catalogue-desktop.png). |
| Strengthened final MOCK, 01:45:00-01:45:09 UTC | 40/40 pass, zero console/page errors, 22 PNGs | Adds fresh snapshot digest/span binding following independent source review. [Report](MOCK-report.json), [raw attempt](2026-10-10T01-45-00-027Z-MOCK-report.json). |
| Frozen v3 natural model/merchant flow, 01:58:53-01:59:05 UTC | 24/24 pass, zero console/page errors, 8 PNGs | Actual loopback HTTP and two sequential Qwen reviews; real synthetic merchant edit in temporary data. [Report](report.json), [raw attempt](2026-10-10T01-58-53-919Z-report.json). |

## Actual frozen-v3 flow

The helper restarted after freeze and imported module SHA-256 97b5d56012cb40331ddd87f5b7af24d459cefe5c37aa25a5ff5c72fd4d66e130. The browser guarded this against [freeze-v3.json](../../model-check/freeze-v3.json). Reviews a21a0ee6-3cb9-4437-af95-e7726e283327 and becaf0d1-757a-4c6e-93c3-8c81d54a9ef6 report actual qwen3.5:4b-q4_K_M, quote-suggestions kind, v3 version and positive durations 4670/1802 ms. No unavailable fallback or status/verdict field appeared. No source/prompt/schema tuning occurred after the run.

All three buyer requirements received source-checked excerpt selections and the two fixed generic question templates. Original edition selected the edition sentence; complete contents selected the packaging/key, antenna inventory and unverified-origin sentences; original box selected packaging inclusion and box/figure condition. These are unverified, partial suggestions with complete saved seller context beside them. Source-checked means exact source integrity only; this UI run is not a selection-relevance/completeness or seller-truth accuracy score.

The actual merchant POST changed description and price from version 1/$48 to version 2/$49. A subsequent actual GET returned the old review stale=true, preserving its original source text/digest/version/amount. The UI displayed current merchant text/$49 beside full saved version-1 text/$48 and disabled stale acknowledgement/decision/checkout controls. A distinct new review had a new source digest matching the edited description, exact new source spans, version 2/$49 and no prior confirmation. A fresh keyboard acknowledgement and explicit decision were required. Refresh, back/forward navigation, positive draft guards, one-request repeated-click protection and desktop/mobile overflow passed. There were zero order-create/capture/reconcile requests; the normal .data database was not modified.

## Verified fixture behavior

Requirements sit beside suggested exact excerpts and server-template neutral questions. Integrity labels are Source checked, No quote suggestions, Source check failed or Suggestions unavailable. No Match/Contradiction/Unknown verdict badge is rendered. Wrong-component and different-variant sentences are visibly partial, unverified quote suggestions; source integrity disclaimers and the full listing keep their limits visible. Their selection relevance is deliberately not graded by this UI suite.

Instruction-like passages excluded from selection remain in complete saved seller context with an exclusion notice. Literal img/onerror markup appears as text in both current and saved descriptions; no element is created and the fixture execution flag remains absent. Invalid, unavailable, untrusted or source-mismatched suggestions display no quotations/questions; the generic For your review prompt is explicitly human-owned. Valid empty selection uses only the server's generic clarification question. Historical reviews and receipts preserve excerpts/full context and suppress saved semantic verdicts and advice reasons.

The meaningful draft check begins with enabled confirmation, changes a requirement, observes disabled acknowledgement/confirmation and draft notice, then restores the saved requirements. Keyboard Space/Enter acknowledgement/decision, heading/main focus, repeated-click one-request loading guard, refresh persistence, real history back/forward and mobile wrapping pass. Merchant fixtures show version 1/$48 -> version 2/$49, preserved stale full context/amount, disabled stale controls, distinct unconfirmed fresh snapshot and independent new explicit decision. These are browser fixture states, not server/model/payment evidence.

Pending, ambiguous, failed, cancelled and legacy receipt fixtures distinguish local checkout state, PayPal order status and actual capture status. Provider order COMPLETED with capture PENDING is never shown as paid. No completed payment fixture exists. Disabled checkout creates no order/capture/reconcile request; local cancellation is the only mocked order POST.

## Screenshots and inspection

Every attempt has immutable screenshots in its own timestamped runs directory; latest copies are convenient for delivery. No DOM/CSS is altered or hidden for captures. Capture scrolls to the top and restores prior scroll to avoid a known Chromium fixed skip-link compositing artifact.

The actual current catalogue, MOCK desktop evidence, wrong-component/variant mobile, source-mismatch failure and legacy pending receipt were viewed with view_image. Actual frozen-v3 evidence desktop/mobile, stale saved review and fresh decision screenshots were also inspected. Selected views show legible hierarchy, source/context warnings, neutral badges, full saved context and clear $49 current/$48 old snapshot separation, with no visible clipping/overlap. The fresh decision heading receives a visible native focus outline. DOM overflow checks pass; not every PNG has manual pixel inspection.

Actual frozen-v3 screenshot inventory:

- [Catalogue desktop](01-catalogue-desktop.png), [requirements desktop](02-requirements-desktop.png)
- [Evidence desktop](03-evidence-desktop.png), [evidence mobile](04-evidence-mobile.png)
- [Stale review desktop](05-stale-review-desktop.png), [fresh review desktop](07-fresh-review-desktop.png), [fresh decision desktop](08-fresh-approval-desktop.png)
- [Catalogue mobile after the isolated edit](06-catalogue-mobile.png)

Selected labeled MOCK views:

- [MOCK evidence desktop](MOCK-03-evidence-desktop.png), [mobile](MOCK-04-evidence-mobile.png)
- [MOCK wrong component/variant desktop](MOCK-wrong-component-variant-desktop.png), [mobile](MOCK-wrong-component-variant-mobile.png)
- [MOCK mismatch failure](MOCK-no-suggestions-source-mismatch.png), [unavailable](MOCK-no-suggestions-unavailable.png)
- [MOCK legacy review](MOCK-legacy-review.png), [legacy receipt](MOCK-receipt-legacy.png)
- [MOCK stale](MOCK-05-stale-review-desktop.png), [fresh decision](MOCK-08-fresh-approval-desktop.png)

Full paths and screenshot focus/scroll states are in each raw report. Source/selection/integrity model evaluations remain separate.

## Preservation and cleanup

Before v3 edits, 44 v2 report/screenshot/cleanup/script files were copied to [frozen-v2](../frozen-v2) with SHA256-manifest.json; zero hash mismatches were verified. V1 remains under frozen-v1. The first pre-freeze owned QA server stopped and its exact temporary data was removed and verified absent at 01:47:38 UTC: [cleanup](2026-10-10T01-40-54-748Z-server-cleanup.json).

After the natural flow, owned Qwen unload returned unloaded=true and residentAfter=[] at 01:59:31 UTC: [model cleanup](model-cleanup.json). Model ownership returned to root/evidence; no later residency claim is made. The parent-owned Ollama service was left running for parent cleanup. Owned helper session 8183 closed with exit 0 and removed only its exact verified data directory at 01:59:47 UTC: [server cleanup](server-cleanup.json), [timestamped record](2026-10-10T01-47-59-391Z-server-cleanup.json). Native filesystem verification confirms the directory no longer exists. Parent services and normal .data were untouched.

## Remaining gates

Browser/rendered UI and natural frozen-v3 merchant flow gates pass. Real PayPal sandbox checkout stays disabled and unverified until secure user-provided sandbox credentials and explicit approval for sandbox buyer/provider actions. No mock success represents real payment. The prototype is not yet hackathon-ready on that integration gate. Separate frozen model source/selection evaluation remains owned by the evidence agent.
