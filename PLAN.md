# Second Look prototype plan

2026-10-09. Fresh standalone project; working title is not name-cleared. No previous project or benchmark artifacts will be changed.

1. Use Node 24 built-in HTTP, SQLite, fetch and test runner, vanilla ES modules and CSS. No runtime packages, container, paid API or build step. Brand lives in one config module. Original SVG collectible art; no art is evidence.
2. Implement six synthetic merchant listings and persistent, session-owned evidence reviews. Qwen3.5 4B Q4 runs only through loopback Ollama with bounded requests, schema and quote validation. Hostile/instruction text and invalid model output fail closed visibly. Human review is explicit.
3. Implement sandbox-only PayPal Orders v2 server create/approval/capture/reconcile. Prices are integer cents from a reviewed server snapshot. Persistent idempotency and stale version guards protect checkout. Credentials remain absent; no PayPal call or account action during this build.
4. Build a clean accessible shop, detail/evidence review, receipt, and controlled merchant edit demonstration. Loading, unknown, invalid, stale, cancelled, pending, ambiguous and failed states are visible.
5. Run unit/integration tests including model contract, merchant edits, payment mocks and persistence. Attempt the documented browser route once, then the supported headless fallback if unavailable. Inspect desktop/mobile screenshots. Run fresh local Qwen holdouts only after the parent coordinates Ollama cleanup; preserve per-case raw output separately from tuning/fixtures.
6. Deliver README, MIT license, dependency/model notices, test results and screenshots. Real sandbox checkout and supported browser QA are explicit readiness gates.

## Visual specification

Quiet collector's catalogue: white background, charcoal text, deep green actions, warm paper-colored art stages. System sans UI with Georgia display headings. Six original boxed objects, each with a distinct motif and consistent perspective. Open header, compact intro, 3-column shop (2 at tablet/1 at phone); detail has item description and requirement/evidence rail. Evidence cards show requirement, status word, exact quote and validation note; controls have visible focus and 44px targets. No generated image service under the no-paid-resources constraint. Mobile stacks regions without hiding seller text or payment status.

## Initial blockers

- Parent-thread tool cannot resolve source thread. Await cleanup handoff before starting a competing Ollama session.
- Browser/IAB route is reported broken with MXC HRESULT 0x80070003. Validate the documented route once; no unchanged retry, network binding change, tunnel or sandbox bypass.
- Sandbox credentials/account and buyer approval are intentionally not authorized yet.

## Authorized validation continuation (2026-10-10)

The parent's supported narrow execution review resolved restricted loopback/browser failures without changing binding or disabling Chromium's sandbox. Preserve initial failures alongside actual HTTP/model/browser results. Run the newly supplied independent holdout once against frozen v1, report failures, then preserve v1 and refine broad validator behavior as v2. Treat exposed cases as regressions afterward. Compute the budget example from trusted integer cents separately from model evidence, and verify persistent stale review/approval. Re-run the real browser flow against v2 in an isolated local database, including a controlled merchant edit, before packaging. Real PayPal actions remain blocked on secure setup and explicit authorization.

## Approved quote-first redesign (2026-10-10)

The user approved suggested quotations, full seller context and neutral questions instead of automated match/contradiction verdicts. Preserve v1/v2 freezes, evaluations, screenshots and delivered ZIP provenance. The prior ZIP and delivery metadata are copied byte-for-byte under `deliveries/v2/` before edits.

1. Replace semantic vocabulary guards with bounded server-owned source spans/IDs and mechanical integrity checks. The local model selects eligible spans and neutral question template IDs; exact quotation establishes source integrity only. Keep instructions untrusted and excluded from suggestions, and show full immutable seller context. Missing or failed output has an honest no-suggestion state.
2. Update requirement/quote/question cards and receipt wording. Keep independent buyer acknowledgement, draft guards, stale-version rejection, immutable snapshots, server prices and sandbox idempotency unchanged. Historical records retain original bytes and have a clearly labeled reading view without buying verdicts.
3. Separate integrity tests from semantic retrieval assessment: relevant coverage, omitted important exclusions, wrong component/variant and question premises. Freeze v3 source/prompt/schema before requesting fresh parent cases. Old cases are exposed regressions; evaluate new cases once and retain failures without an unbounded tuning loop.
4. Use the established narrowly approved loopback Ollama and sandbox-enabled Playwright route for actual model/browser checks and desktop/mobile screenshots. Coordinate exclusive model use; stop owned services and unload owned model use. No new models, paid calls, account/credential/payment actions, publication or system/startup/network changes.
5. Update runnable docs, demo narrative and notices. Replace the existing Library ZIP while preserving its identity/version history, update the current shop screenshot and deliver quote-panel evidence. Real sandbox checkout remains a separate blocked gate pending secure setup and user authorization.

## Focused retrieval revision v4 (2026-10-10)

The user approved one focused improvement after the v3 fresh run exposed omissions and irrelevant selections. Preserve its frozen source, raw first results, screenshots, test ledger and delivered ZIP before editing. No payment/account/publication actions are authorized.

1. Diagnose general retrieval causes: permissive contextual selection can choose category/contact text for an unanswered fact; a three-quote ceiling cannot cover longer compound requests; generic scope questions do not address missing information. Use a single bounded retained-Qwen call with explicit relevance/empty-selection and coverage instructions, a modest higher quote limit, and restrained neutral questions. No case-specific vocabulary or semantic proof classifier.
2. Add general deterministic contract regressions and preserve all historical test routing. Keep full saved seller context, exact server spans, independent human review, immutable receipts, server money and approval/version gates.
3. Run the six exposed cases once as development regressions. Freeze revised source/prompt/schema before revealing independently authored fresh cases. Run the small varied fresh set once; human assess missing context and irrelevant/unsupported suggestions separately from exact quotation integrity. No tuning or rerun against the fresh set.
4. Recheck real model/browser review, mobile and stale merchant-edit flows with sandbox payments disabled. Use only established loopback/Chromium-sandbox-enabled tooling; unload owned model use and stop owned services.
5. Give an honest quality verdict. Update docs and verified Library ZIP if improved, retaining version history. If quality remains inadequate, stop and report failures rather than repeat tuning.

Execution note: the same final v4 implementation was frozen before both live sets, rather than between the exposed regressions and fresh evaluation. This stricter order required no intervening prompt changes. Both sets ran exactly once, with failed rows retained. Browser mock and actual loops used owned temporary state and sandbox-enabled Chromium; model use was unloaded and listeners stopped. No further tuning follows the fresh results.
