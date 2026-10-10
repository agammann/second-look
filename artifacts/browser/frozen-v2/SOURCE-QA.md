# UI source audit and repaired findings

2026-10-10 UTC. Source inspection is recorded here; rendered browser results are in [QA.md](QA.md). The supported approved Playwright execution context now works.

## Source checks

- node --check passed public/app.js, public/dom.js, public/art.js, browser-check.mjs and the isolated QA server helper.
- Seller descriptions, requirements, quotes and messages use text nodes. Listing text is not evaluated or rendered as executable HTML.
- Original decorative SVG art is visibly fictional and never enters the model evidence flow.
- Source includes language, viewport, semantic main/navigation/headings, native labeled controls, skip link, loading/status/error announcements and evidence status words.
- Buyer acknowledgement is explicit. Checkout submits a saved review ID; server data supplies price/version/snapshot. Missing PayPal configuration visibly disables checkout.
- Receipt snapshots preserve description, requirements, amount, version and provider IDs. Callback URLs are explicitly not proof of approval/payment. Approval links are restricted to the sandbox host.
- Route reads use abort/version guards. Async mutations suppress results after navigation; back/pageshow reload server state.

## Findings repaired by frontend agent

| Finding | Final behavior and evidence |
| --- | --- |
| Changed requirements left old controls valid | Draft differences disable acknowledgement/confirmation/checkout and show a new-review note. Live and mock checks pass. |
| Local checkout status labeled actual capture status | Local state, provider order state and actual capture status are separate. MOCK PENDING/DECLINED/no-capture checks pass; no real provider validation claimed. |
| Confirmation heading could not receive focus | approval-heading has tabindex=-1. Live and mock keyboard confirmation focus checks pass. |
| Skip-link fragment navigation replaced focused main | Explicit skip handler prevents the native fragment/popstate reload, replaces only the hash, and focuses current main. Rendering preserves already-focused main. Final v2 mock focus check passes; raw failure is retained. |
| Boolean verification issue printed true | Plain warning uses server message/fallback. MOCK ambiguous warning is visible. Completed captures with a new verification issue also warn by source inspection. |
| Failed merchant refresh could leave old review enabled | Review is marked stale before refresh and old acknowledgement resets. MOCK and isolated actual v2 stale/fresh confirmation flows pass. |
| Two muted text colors below 4.5:1 | Intro/empty-evidence copy use --muted. All 18 selected declared pairs pass 4.5:1 in contrast.json; original failures remain in contrast-before.json. This is not computed-style coverage or a formal accessibility audit. |
| Receipt backend states differed | Source handles awaiting_approval/capture_in_progress/refunded. Stale/failed capture actions block; terminal orders can reconcile. MOCK cancellation/status checks pass. |
| Valid Unknown context needed different semantics from support quotes | Valid Unknown quotes display Exact seller context · no conclusion with Unknown/no-supported-conclusion wording. Invalid quotes are suppressed. Final MOCK desktop/mobile, keyboard and refresh checks pass. |
| Evidence source exclusions needed visible disclosure | Optional bounded, hardcoded analysis.notices displays as plain text in review/receipt. Explicit MOCK exclusion notices passed both rendering checks. |

This QA agent changed browser scripts/artifacts only; frontend owns app repairs. The integration auditor independently reviewed the scripts. Its findings were fixed: raw quote DOM assertion, positive enabled-confirmation draft gating, DOM price/version/snapshot assertions, and exact owned-directory cleanup equality. Root also fixed SQLite handle cleanup after a server listen failure. A preliminary apostrophe concern was a PowerShell display-encoding artifact, ruled out by byte inspection and syntax checks.

## Limits

Selected actual v2 desktop/mobile evidence, stale and fresh-confirmation screenshots have no visible clipping, overlap or horizontal overflow. Native controls and keyboard flow pass. This does not establish complete assistive-technology/all-device accessibility coverage. Frozen-v2 actual merchant re-review passed 24/24 UI/integration checks; separate model accuracy evaluation is not represented by that UI score. Actual PayPal sandbox buyer approval/capture remains a separate blocked integration gate.
