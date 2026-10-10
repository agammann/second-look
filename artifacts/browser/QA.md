# Browser QA ledger

2026-10-10 UTC. Existing Playwright 1.62.1/Chromium 151.0.7922.34, headless interactive automation, chromiumSandbox:true, narrowly scoped supported execution approval. [ROUTE.md](ROUTE.md) preserves initial failures and context change.

| Run | Result | Scope |
| --- | --- | --- |
| Frozen v1 natural app, 00:07:30–00:07:35 UTC | 17/17 pass, zero console/page errors | Actual HTTP app/one Qwen review, PayPal disabled, no merchant mutation. [Raw report](frozen-v1/report.json). |
| Extended pre-v2 MOCK UI, 00:18:58–00:19:02 UTC | 28/28 pass, zero console/page errors | Intermediate fixture suite. [Raw report](MOCK-report-pre-v2.json). |
| Final v2 MOCK UI, 00:31:28–00:31:36 UTC | 34/34 pass, zero console/page errors | Rendered app/browser fixtures, stale/fresh confirmation, valid Unknown context, exclusions and receipt states. No model/server-state/provider validation. [Raw report](MOCK-report.json). |
| Current actual catalogue, 00:37:23–00:37:24 UTC | 6/6 pass, zero console/page errors | Current public UI against actual HTTP app; only config/listing GETs, no model/provider calls. [Raw report](CURRENT-report.json), [screenshot](CURRENT-catalogue-desktop.png). Desktop only; the initial report's shared viewport list also includes the planned mobile viewport, which was not exercised in this capture. The generator has been corrected for future catalogue-only runs. |
| Isolated frozen-v2 natural app, 00:43:59–00:44:15 UTC | 24/24 pass, zero console/page errors | Actual HTTP/Qwen, two sequential reviews, real synthetic merchant edit and new review confirmation. [Raw report](report.json). |

Natural v1: original edition MATCH with exact source sentence; complete contents UNKNOWN/INVALID because a shortened quote was rejected; original box MATCH with exact sentence. Unknown/invalid was visible. Results describe unverified seller statements, not authenticity/proof of truth. The original report and five screenshots were copied to frozen-v1 before v2 overwrites current files.

Natural frozen-v2: both reviews report Qwen and evidence version 2026-10-10-v2, positive durations 4946/6836 ms, and no unavailable fallback. Original edition MATCH has an exact complete source sentence. Complete contents and original box both remain visible UNKNOWN/INVALID: the model proposed unsupported Match/Contradiction and the validator withheld those conclusions. These are safe false-unknown outcomes in this small natural flow, not a model accuracy score. The UI still requires explicit acknowledgement of uncertainty. No source or model tuning occurred after this run.

The actual merchant edit changed description and price from version 1/$48 to version 2/$49. The server returned stale=true for the old review, retaining its original description/price/version; the UI showed current text/$49 with preserved old evidence/$48 and disabled acknowledgement/confirmation/checkout. A distinct unconfirmed review then snapshotted version 2/$49 and required a new keyboard confirmation. The actual requests contain no order creation, provider capture or reconciliation. The application's normal .data database was not modified.

Checks cover identity/meaningful six-product catalogue, no framework overlay, desktop 1280×900/mobile 390×844 overflow, seller disclaimers, skip link, Space acknowledgement/Enter confirmation/focus restoration, loading/repeated-click guard with one review request, requirements/quotes/status visibility, disabled PayPal, refresh persistence, draft invalidation and navigation. Final mock skip check observed activeElement.id===main. Extended mock checks verify fixture version 1/$48 to version 2/$49, a new unconfirmed review and explicit new approval. MOCK receipt checks distinguish provider order COMPLETED from actual capture PENDING, preserve snapshot amount/version/text after mock edits, and never claim a completed capture. Disabled checkout sends no order-create/capture/reconcile request.

The final v2 suite additionally starts with an enabled, acknowledged but unconfirmed review: changing its draft disables confirmation/acknowledgement, and restoring the saved requirements re-enables confirmation. Merchant assertions verify returned stale snapshots and displayed seller text/current price/old review amount/current version, then the new unconfirmed snapshot/amount/version. History back returns the catalogue; forward restores the saved review; the shop link remains usable. Valid Unknown context keeps an exact sentence without a known conclusion, preserves version/quotes on refresh, and supports explicit keyboard confirmation/mobile wrapping. Known MOCK exclusion notices are visible in review and receipt.

## Failed attempts retained

Initial launch error remains in [route-probe.json](route-probe.json). Three raw mock attempts remain openly:

1. [MOCK-report-first.json](MOCK-report-first.json): stale warning used out of date/Run another review, outside original regex.
2. [MOCK-report-second.json](MOCK-report-second.json): invalid reason had Validation invalid prefix, outside exact-text locator.
3. [MOCK-report-third.json](MOCK-report-third.json): uncertain heading changed from Capture status to Checkout status.

Locators were corrected to stable IDs/status fields/text matching; full suite passed. These were harness wording mismatches, not suppressed app failures.

4. [MOCK-report-fourth.json](MOCK-report-fourth.json), 00:27:59 UTC: genuine skip-focus failure. Native fragment navigation triggered a route refresh which replaced main; Enter changed the hash but focus did not remain on main. Frontend added an explicit stable focus handler and preserved main focus during rendering; the strengthened check now passes. This failure is distinguished from the earlier locator mismatches.

## Screenshot inventory

Actual/frozen-v1:

- [Catalogue desktop](frozen-v1/01-catalogue-desktop.png)
- [Requirements desktop](frozen-v1/02-requirements-desktop.png)
- [Evidence desktop](frozen-v1/03-evidence-desktop.png)
- [Evidence mobile](frozen-v1/04-evidence-mobile.png)
- [Catalogue mobile](frozen-v1/06-catalogue-mobile.png)

Actual frozen-v2:

- [Catalogue desktop](01-catalogue-desktop.png), [requirements desktop](02-requirements-desktop.png)
- [Evidence desktop](03-evidence-desktop.png), [evidence mobile](04-evidence-mobile.png)
- [Stale review desktop](05-stale-review-desktop.png), [fresh review desktop](07-fresh-review-desktop.png), [fresh confirmation desktop](08-fresh-approval-desktop.png)
- [Catalogue mobile after the isolated edit](06-catalogue-mobile.png)

Explicit MOCK UI:

- [Catalogue desktop](MOCK-01-catalogue-desktop.png), [requirements](MOCK-02-requirements-desktop.png), [evidence desktop](MOCK-03-evidence-desktop.png), [evidence mobile](MOCK-04-evidence-mobile.png), [catalogue mobile](MOCK-06-catalogue-mobile.png)
- [Stale review](MOCK-05-stale-review-desktop.png), [three statuses](MOCK-evidence-three-statuses.png), [invalid evidence](MOCK-evidence-invalid.png)
- [Fresh review](MOCK-07-fresh-review-desktop.png), [fresh approval](MOCK-08-fresh-approval-desktop.png)
- [Valid Unknown context desktop](MOCK-unknown-context-desktop.png), [valid Unknown context mobile](MOCK-unknown-context-mobile.png)
- [Pending receipt](MOCK-receipt-pending.png), [ambiguous](MOCK-receipt-ambiguous.png), [failed](MOCK-receipt-failed.png), [cancelled](MOCK-receipt-cancelled.png), [cancel action](MOCK-cancel-action.png)

Frozen v1 catalogue/evidence desktop/evidence mobile plus selected MOCK catalogue/evidence/stale/pending/ambiguous/fresh-review/invalid-evidence/failed-receipt/context desktop/context mobile images were viewed with view_image. Final v2 context-mobile, ambiguous receipt with exclusion notice, and fresh-review captures were also inspected. Selected views are legible, show synthetic/seller notices, and have no visible clipping/overlap. DOM overflow checks pass. Not every screenshot received manual pixel inspection.

Actual frozen-v2 evidence desktop/mobile, stale review and fresh-confirmation screenshots were inspected with view_image. Exact quotes, Unknown/invalid reasons, synthetic/seller warnings, disabled PayPal and changed-version price/snapshot separation remain legible, with no visible clipping or overlap. Fresh confirmation receives a visible native heading focus outline. The current catalogue-only capture was also inspected before parent Library delivery.

The screenshot helper records active focus and skip-link bounds. Chromium full-page capture while scrolled had composited the offscreen fixed skip link into the image even with skipFocused=false and bounds top -80/bottom -36. Final captures first scroll to the top, take the unmodified full page, and restore the previous scroll position. No DOM/CSS content is hidden or altered for screenshots.

## Remaining gates

Browser/rendered UI and frozen-v2 natural merchant flow gates pass. Real PayPal sandbox checkout is disabled until secure user-supplied sandbox credentials and explicit approval for sandbox buyer/provider actions. No real payment success is represented. The prototype is not yet hackathon-ready on that integration gate. Separate model evaluation/holdout results are owned by the evidence agent and remain separate from these UI checks.

## Owned cleanup

The browser closed after the run. Qwen unload verified residentAfter=[] and unloaded=true at 00:44:35 UTC in [after-browser-cleanup.json](../model-check/after-browser-cleanup.json), then exclusive model ownership returned to the evidence agent. The parent-owned Ollama service was not stopped. The owned QA server on 127.0.0.1:4322 stopped and removed only its exact verified temporary data path at 00:45:11 UTC; see [v2-server-cleanup.json](v2-server-cleanup.json). Parent app/Ollama sessions were left untouched.
