# Second Look: PayPal AI Hackathon submission

Prepared for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/). The submission deadline is **November 12, 2026, at 12:00 noon PST** (America/Los_Angeles). The source and captioned demo are published. [Second Look](https://devpost.com/software/second-look-x5nt6q) was submitted after the user completed personal attestations and explicitly approved the final rules/terms agreement and submission.

## Project description

Second Look is a text-only reading aid for one merchant-owned demo shop with six original fictional boxed collectibles. A buyer states up to three requirements, reads local AI suggestions alongside the full seller listing, makes an independent assessment and separately approves sandbox checkout. The working title can be renamed and is not name-cleared.

The problem is selective reading: a short listing may mix included items, missing pieces, uncertainty, corrections or different variants. Highlighting a favorable sentence can hide a nearby qualification. Our quote-first flow keeps the complete saved seller context visible and avoids automated Match/Contradiction/Unknown buying verdicts. PayPal is central to the next step: checkout is tied to the exact listing, price and review the buyer acknowledged, followed by separate sandbox buyer approval and server capture.

## How local AI participates

The application makes a live loopback Ollama request to the retained `qwen3.5:4b-q4_K_M` model for eligible listings. Qwen sees the buyer's requirements, eligible server-owned source spans and a fixed neutral question catalogue. It selects suggested span and question IDs. The application maps accepted IDs back to exact source text and fixed question wording; it does not use canned model suggestions in the app or accept model-generated quotations, question premises or purchase advice.

Bounded input, a roughly 4K context, bounded output, schema/order/ID checks and detected instruction exclusions constrain this path. Malformed or unsupported output produces visible empty suggestions; an unavailable model never fabricates a result. Source integrity is mechanical: it does not verify relevance, completeness, authenticity or truth. The buyer must independently assess omitted important context and whether a quote concerns the intended component or variant. No model tool action or autonomous purchase is supported.

## Checkout and the merchant edit demonstration

The Node application persists session-owned reviews, immutable seller/evidence snapshots and integer-cent server prices in SQLite. Changing a description or price invalidates stale review and checkout approval, requiring a fresh review and buyer acknowledgement. Requirement drafts also guard confirmation. Provider operations and edits are coordinated, and an unresolved prior capture blocks another checkout for the same item in that browser session.

The implemented PayPal adapter uses sandbox-only Orders v2 server create/get/capture, separate buyer approval, persistent request IDs, expected amount/currency/reference checks and verified capture state. Browser callbacks cannot mark an order paid. Receipts preserve the reviewed listing/version, requirements and source suggestions beside actual provider/capture status, including pending, failed or ambiguous outcomes.

Actual PayPal sandbox testing includes **two completed $48.00 USD captures of listing version 1**, one for the initial checkout validation and one for the recorded working demo. The buyer acknowledged the saved review, approved separately on PayPal sandbox, and the app explicitly requested server capture. Receipts showed verified completion with the saved amount/version. Status checks and reload preserved the results; browser callbacks could not change paid state.

A separate cancellation remained uncaptured. An isolated test used PayPal's provider negative-testing simulation to return `INSTRUMENT_DECLINED` during capture (HTTP 422). The app retained an ambiguous local state beside the provider's `APPROVED` order state, with no completed capture. Status checks and reload preserved that state; one capture POST was sent, followed only by status GETs. This was a controlled provider simulation, not an ordinary buyer decline observed in use. Labeled transport mocks remain separate from these actual sandbox requests. No live funds, real cards or bank accounts were used, and no new account or agreement was created or accepted during this continuation.

## Evidence and limits

The focused v4 revision's recorded suite passes 154/154 deterministic checks: 15 current evidence checks, 36 payment/money/HTTP checks and 103 historical checks. The historical browser run passes 24/24 with PayPal disabled, two live Qwen reviews and a controlled merchant edit; labeled MOCK rendering passes 43/43. These counts are separate from the four actual sandbox orders above. [Sanitized sandbox evidence](artifacts/paypal-sandbox/continuation-evidence.json).

V4 uses one bounded model call with up to six exact excerpts. Eight sibling-authored cases were withheld until freeze and ran once: eight actual responses, 11/12 mechanically valid rows and 24 exact displayed excerpts. Human review still found omitted alternative/test context, unnecessary excerpts, routine generic questions and one rejected empty-selection/question combination. The sibling author knew prior failures; this is a small private holdout, not naive external independence or an accuracy estimate. STATUS.md records raw outputs, per-requirement assessment and inspected screenshots. V3's 3/6 adequate-context result and all historical failures remain preserved in README.md. Source integrity must not be presented as retrieval reliability.

The project uses Node built-ins, plain browser modules and original code-native SVG art, with no paid AI API, marketplace scraping, OCR/image evidence or real payments. Original code and fictional assets use MIT; model/runtime notices are in NOTICES.md. It is a bounded local prototype, not a production merchant service or a claim of reliable authentication. Actual sandbox checkout does not resolve the measured retrieval weaknesses, which remain disclosed.

## Tools and judge setup

The application uses PayPal Orders v2 sandbox APIs for server-side create/get/capture, local Ollama with `qwen3.5:4b-q4_K_M` for source-span/question selection, and Node 24 built-ins including SQLite for persistent snapshots and checkout state. It has zero npm runtime dependencies and no build step. Model weights and runtimes are not bundled.

Judges can run it locally using the fresh-machine instructions in README.md: install Node 24.2+, install Ollama and obtain the exact local model on their own new machine, then start the loopback app. For payment testing, judges use their own free Sandbox Business application and generated Sandbox Personal buyer. Sandbox app credentials stay in a protected, ignored local `.env`; no shared merchant secret is published. A regular PayPal login is used only for Developer Dashboard access, while checkout uses the generated fictitious sandbox buyer login and test funds. LICENSE and NOTICES.md preserve the project and external component licensing.

## Published materials and judge access

The [official challenge requirements](https://paypalaihackathon.devpost.com/) require a public GitHub/GitLab/Bitbucket repository with runnable source, assets, instructions and a visible open-source license, plus a working demo video **under three minutes, publicly visible on YouTube**. Complete local setup instructions can satisfy functional demo access without public hosting.

- Public source repository: [agammann/second-look](https://github.com/agammann/second-look).
- Local working demo: [65-second captioned WebM](artifacts/demo/second-look-demo.webm), with [captions](artifacts/demo/second-look-demo.vtt) and [recording evidence](artifacts/demo/demo-evidence.json). It shows actual live review, acknowledgement, sandbox order/capture and receipt reload. Four takes are edited together; PayPal's account/approval screen is excluded and its separate approval is explained in the captions. No audio is required to follow it.
- Public YouTube demo: [Second Look sandbox demo](https://www.youtube.com/watch?v=znVLaGqigrw), 65 seconds with visible captions.
- Judge access: complete and verify the documented setup, available free of charge through **December 15, 2026, at 8:00 a.m. Pacific**, when judging ends.
- Human review: confirm eligibility, project ownership/licensing, and development during the submission period; explain significant updates if any part predates it. Review the [official rules](https://paypalaihackathon.devpost.com/rules) before accepting terms, registering or submitting. The user completed the required personal attestations and explicitly approved the final rules/terms agreement and submission.

Sandbox tests, local recording, captions, source packaging and the submission narrative are prepared. Source and video publication and final submission are complete. [Submitted project](https://devpost.com/software/second-look-x5nt6q). Keep the public source and demo freely accessible throughout judging. Retrieval limitations remain disclosed; this draft makes no blanket hackathon-readiness claim.
