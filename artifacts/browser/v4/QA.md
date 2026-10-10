# V4 focused browser QA

2026-10-10 UTC. Root executed the authorized local commands using existing Playwright/Chromium with chromiumSandbox:true on http://127.0.0.1:4322. Desktop 1280x900 and mobile 390x844 were exercised. Browser QA inspected the saved reports and pixels afterward; it started no services or model requests in this inspection turn.

| Run | Result | Evidence |
| --- | --- | --- |
| Labeled MOCK, 02:37:46-02:37:57 UTC | 43/43 pass, zero console/page errors, 23 PNGs | [Report](MOCK-report.json), [immutable attempt](2026-10-10T02-37-46-431Z-MOCK-report.json) |
| Actual frozen-v4, 02:39:13-02:39:24 UTC | 24/24 pass, zero console/page errors, 8 PNGs | [Report](report.json), [immutable attempt](2026-10-10T02-39-13-207Z-report.json) |

The focused cap checks show all six exact v4 suggestions, withhold seven v4 suggestions, and preserve the prior saved-v3 limit by withholding four. Existing MOCK checks cover complete context, wrong-component/variant excerpts visibly unverified, excluded instruction text, literal markup, missing/invalid/unavailable/untrusted/source-mismatched output, historical review/receipt compatibility, pending/failed/ambiguous/cancelled capture displays and no completed payment fixture. Mock tests validate UI mechanics, not actual model/provider behavior.

The actual flow received two sequential qwen3.5:4b-q4_K_M responses in 4683/2145 ms, kind quote-suggestions and evidence version 2026-10-10-v4. The harness checked module SHA-256 77a7c8d011b40a162fbff34472f6ed5cceb19b57612c2f5dee98e79742b20c42 against freeze-v4.json. In this small catalogue flow, both reviews selected one edition sentence, two contents excerpts and one packaging excerpt. This is a source integrity and interaction check, not an AI relevance/completeness score or proof of seller truth. The separate AI-quality audit remains pending at this write.

Native keyboard/skip focus, repeated-click one-request protection, positive draft guard, saved review refresh, back/forward navigation and mobile overflow checks pass. Actual merchant description/price changed $48/version 1 to $49/version 2; stale controls were disabled and old text/digest/amount retained beside the current listing. A distinct fresh digest/snapshot required new independent acknowledgement and decision. There were zero order-create/capture/reconcile requests; PayPal was disabled.

## Pixel inspection

Actual [desktop evidence](03-evidence-desktop.png), [mobile evidence](04-evidence-mobile.png), [stale review](05-stale-review-desktop.png), and labeled [MOCK six-suggestion capture](MOCK-v4-six-suggestions.png) were viewed with view_image. Selected captures have clear neutral source-integrity labels, complete saved context, exact excerpts, explicit buyer decision controls and no visible clipping/overlap. The stale capture clearly separates current $49/version 2 from saved $48/version 1 with disabled controls. The six-quote fixture stays visibly MOCK and partial/unverified. No product fix was needed. Not every PNG was manually inspected; this is not formal accessibility or cross-browser certification.

All screenshot paths and focus/scroll states are in the raw reports. Timestamped run directories preserve original captures; latest copies are for convenient delivery. No source content or CSS was hidden/altered for screenshots. V3 raw work and harness snapshots remain archived under frozen-v3 and deliveries/v3.

## Cleanup and remaining gate

Root's custom [v4 Qwen cleanup](../../model-check/v4/after-browser-cleanup.json) records verified empty model residency at 02:39:44 UTC. The model/runtime service was root-owned. Helper session 23861 closed with exit 0; [cleanup](server-cleanup.json) records exact owned-v4-rmjUlm removal at 02:39:47 UTC, and filesystem inspection confirms it is absent. The earlier non-TTY helper auto-exited on stdin end and removed only its owned-v4-Qi9PvV directory; [its record](2026-10-10T02-37-15-111Z-server-cleanup.json) is preserved. Root owns any empty temporary-parent removal.

Real PayPal sandbox checkout remains unconfigured and unverified. No mock success represents a real payment. Passing UI mechanics does not resolve the separate AI-quality audit or sandbox integration gate.
