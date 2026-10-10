# Second Look

[Watch the 65-second captioned demo](https://www.youtube.com/watch?v=znVLaGqigrw) · [Public source](https://github.com/agammann/second-look)

A local prototype for one fictional collectible shop. Buyers state up to three requirements; local Qwen suggests exact seller excerpts and neutral questions to help them read the **full saved listing**. Buyers make their own assessment and explicitly acknowledge their review before separately approving a PayPal **sandbox** checkout.

The current v4 flow offers quotations, not Match/Contradiction/Unknown buying verdicts. One bounded Qwen call can select up to six exact source excerpts per complete requirement. `quote-suggestions` validates source IDs and maps them to exact server-owned text. That establishes quotation integrity only. Semantic relevance, completeness, authenticity and truth remain unverified. Important context may be omitted from suggestions and must be evaluated separately in the full listing.

**Status: focused v4 build and actual sandbox checkout tested; local submission materials prepared.** The suite passes 154/154; the historical browser flow passes 24/24 with PayPal disabled, and labeled MOCK rendering passes 43/43. The fresh sibling-authored eight-case run returned eight actual responses: 11/12 rows passed the model contract and all 24 displayed excerpts were exact source spans. Human assessment still found omitted context, excess excerpts and generic questions; one empty selection used an invalid question combination and was visibly withheld. This small sample does not establish reliable retrieval. The authorized continuation completed two $48.00 USD/v1 sandbox captures using a generated fictitious buyer, including a fresh order for the working demo. A separate cancellation remained uncaptured. An isolated official provider simulation returned HTTP 422 `INSTRUMENT_DECLINED`; the app retained ambiguity with no capture and GET-only reconciliation. Return/cancel callbacks and a pre-approval capture attempt did not bypass provider verification. [Sandbox evidence](artifacts/paypal-sandbox/continuation-evidence.json), [STATUS.md](STATUS.md), [DEMO.md](DEMO.md) and [SUBMISSION.md](SUBMISSION.md) record completed local testing and publication. [Second Look](https://devpost.com/software/second-look-x5nt6q) was submitted to the PayPal AI Hackathon after human confirmation.

Second Look is an easily renamed working title, not legally or commercially cleared. All six boxed collectibles, descriptions and decorative SVG illustrations are original synthetic demo material. Scope excludes marketplaces, scraping, OCR, image evidence, real payments, authenticity/pricing advice, seller onboarding, escrow, subscriptions and autonomous purchasing.

## Run locally

On a fresh judge machine, install **Node 24 LTS, version 24.2 or newer**, using the installer or standalone binary for your operating system and architecture from the [official Node download page](https://nodejs.org/en/download). This project was tested with 24.19.0. Open a new terminal and check `node --version`. Clone or extract the source, then open PowerShell in the folder containing `server.mjs`; the commands below use PowerShell. No npm install, package manager, Docker or build step is required. Start the app in an authorized local terminal:

```powershell
node --env-file-if-exists=.env server.mjs
```

Open `http://127.0.0.1:4310`. Use that exact host; `localhost` is intentionally not a second app origin. The server binds only `127.0.0.1`. A user-created local `.env` can set `PORT` from 1024 to 65535. SQLite state and the session-signing key are generated under `.data/`; preserve both for browser sessions and receipts to survive a restart. Neither is served or packaged. This is a single-process demo with no login startup changes.

PayPal is disabled by default. The server references client credentials only when `PAYPAL_SANDBOX_ENABLED=true`. There is no mock payment mode or fake success button in the app.

For suggestions, use Ollama with the exact `qwen3.5:4b-q4_K_M` model. **On a new machine only**, install Ollama from its [official download page](https://ollama.com/download), following the [Windows guide](https://docs.ollama.com/windows) or instructions for your platform. The Windows installer starts a background app; quit your own newly installed Ollama tray app before starting the foreground session below. On the existing development machine, reuse the retained runtime and model without installing or downloading them again. After coordinating exclusive use and confirming no competing service or loaded user model, start your authorized foreground loopback session:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
ollama serve
```

Keep that terminal open. In a second PowerShell terminal, **only on a new machine where this model is absent**, obtain the [exact model tag](https://ollama.com/library/qwen3.5:4b-q4_K_M) (about 3.3 GB) using the official [Ollama CLI](https://docs.ollama.com/cli):

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11434'
ollama pull qwen3.5:4b-q4_K_M
ollama ls
```

Confirm the exact tag is listed, then use the app in your browser. The foreground command does not configure automatic startup; [Ollama's local-only setting](https://docs.ollama.com/faq) disables cloud features for that session. No other model, Ollama account, cloud API key or paid AI API is required. Runtimes and weights are not bundled; retain their separate licenses and the project [NOTICES.md](NOTICES.md). A cold request may take about a minute. When inference is unavailable or invalid, the review visibly contains no accepted suggestions or questions; the full saved seller text remains readable. Stop only your own runtime session and unload only model use you own. Normal app requests use a two-minute residency; the isolated evaluation runner attempts cleanup after its owned inference attempts.

## Quote-first flow

1. Choose a synthetic collectible and enter one to three requirements, each at most 160 characters. Seller descriptions are bounded to 2,400 characters.
2. Select **Find seller quotes**. Qwen receives eligible server-owned source spans and a fixed neutral question catalogue. It selects span/question IDs, rather than generating quotations, question wording or buying decisions. The server accepts only bounded, unique, eligible selections in ordered requirement rows and displays each requirement beside the mapped text and validation explanation.
3. Read the **full saved seller listing**, including unselected and excluded text. Source exclusions identify detected instruction-like passages; they do not prove broad instruction resistance. Empty suggestions do not establish that information is absent. Decide whether each excerpt concerns the intended component/variant and what important context or clarification is missing.
4. Make an independent assessment, check the acknowledgement and select **Save my review decision**. AI output never performs this action. Changed requirement drafts disable confirmation and checkout until a fresh review or exact revert.
5. With approved sandbox setup, create an order for the reviewed server-owned price and version. Approve it separately on PayPal sandbox, return, then explicitly request server capture. Returning, cancelling or browser callbacks cannot mark payment completed.
6. The receipt preserves the description, requirements, quote/question suggestions, source metadata, price and listing version. Local state, provider order status and actual capture status remain separate. Pending, failed and ambiguous states are not paid; a verification issue remains visible beside the last verified status.
7. Use **Merchant edit demonstration** to change the description or price. An old review and checkout approval become stale. Review the new snapshot, acknowledge it and obtain fresh buyer approval. A provider operation lease prevents edits racing capture; an unresolved prior capture blocks another checkout for the same item in that browser session.

Historical reviews retain their original saved analysis. Their reading view is labeled historical and does not present old automated verdicts as current buying advice.

## Tests and evaluation

```powershell
node --test tests/*.test.mjs
node scripts/check-http.mjs
node scripts/check-model.mjs --evidence-version v4 --evaluation exposed-regression --owns-model-use --output artifacts/model-check/new-v4-run.json
node scripts/browser-check.mjs
```

The deterministic suite passes 154/154: 15 current v4 evidence/transport checks, 29 payment, 4 money and 3 HTTP-handler checks, plus 103 preserved historical evidence/runner checks. [Raw test output](artifacts/test-results.txt). Model/PayPal transport mocks exercise contracts and actual SQLite/service state; HTTP-handler tests use a transport double. Actual network smoke passes five checks separately. Mocks do not establish real provider or AI quality. `check-http.mjs` fails when actual network access is blocked.

V4 is one focused prompt/selection-limit revision, frozen before all v4 inference. It keeps the same exact-span validation, fixed questions, full saved text, independent buyer acknowledgement and deterministic payment controls. Six exposed v3 cases ran once as regressions, followed by eight newly authored sibling cases once without tuning or reruns. The sibling author knew prior failures, but withheld inputs and criteria from implementation until freeze; this is not naive external independence. Gold stayed outside model requests. [V4 freeze](artifacts/model-check/freeze-v4.json), [exposed raw run](artifacts/model-check/v4/exposed-six-first.json), [fresh raw run](artifacts/model-check/v4/sibling-eight-first.json), [per-requirement human audit](artifacts/model-check/v4/SOURCE-AUDIT.md), [provenance](artifacts/model-check/sibling-quote-v4-input-provenance.json).

The exposed run improved chair-charge coverage and avoided unrelated wardrobe quotes, but retained lamp context omissions, lost one table alternative, added an unrelated chair-condition sentence and rejected an empty-plus-scope-question row. The fresh run retained important corrections, exclusions, unknown runtime and component scope, while leaving alternative/test context and excerpt economy limits. Exactness does not repair those shortcomings. Both runs preserve failed rows. New cases are now exposed; future use is regression only. Owned model use was unloaded and the temporary listeners stopped. [Run stats](artifacts/model-check/v4/run-stats.json), [cleanup](artifacts/session-cleanup-v4.json).

The v3 assessment separates mechanical integrity from retrieval quality: relevant coverage, omitted important exclusions, wrong component/variant and question premises. Exact source text cannot establish these semantic properties. The first fresh six ran once after freeze: 6 actual responses, 8 valid rows and 14 exact suggestions; adequate context in table/bookcase/camera, partial lamp/chairs and irrelevant nonempty wardrobe selections. All eight questions were neutral fixed templates but mostly generic or redundant. No tuning or rerun followed. [First raw output](artifacts/model-check/independent-quote-v3-first.json), [independent semantic audit](artifacts/model-check/v3/SOURCE-AUDIT.md).

The reusable runner requires empty residency and explicit ownership, never starts a service, fixes model/context/output bounds, preserves raw responses/failures, verifies frozen source and attempts owned model unload even after timeout. Use a new output path; `--dataset` selects exact fixtures. Fresh evaluation is reserved for newly supplied unseen cases; all recorded sets are now exposed and future runs must use `exposed-regression`. Gold criteria never enter model input. `--evidence-version v3` selects archived v3; v1/v2 use their preserved legacy engine. [Historical runner checks](artifacts/model-check/v3/RUNNER-CHECKS.md). The recorded first v3 six used a separately preserved minimal harness because the reusable runner was unfinished at that moment.

Earlier suites and reports are preserved unchanged. The historical v2 delivery recorded 110 tests, including 60 then-current application/runner/backend/HTTP tests and 50 historical v1 evidence tests; that is not a v3 coverage count. [Preserved v2 test output](artifacts/test-results-v2.txt). Legacy v1/v2 evidence tests exercise their preserved modules as historical regression coverage.

| Historical evaluation | Recorded result and failure audit |
|---|---|
| v1 internal synthetic set | 21/24 delivered labels, 14/24 full contracts. Seven forbidden Unknown quote arrays and three guard rejections remained failures. This internally authored set inherited benchmark failure-summary context. [Audit and raw-output links](artifacts/model-check/INTERNAL-RESULTS.md). |
| v1 first parent independent set | 4/12 delivered labels, 1/12 contracts; one accepted false contradiction. Quote layout, subject scope, output shape and uncertainty failures were retained. These cases became exposed regression data. [Per-case audit](artifacts/model-check/INDEPENDENT-V1-RESULTS.md). |
| v2 exposed regression | 7/12 delivered labels/contracts, compared with 10/12 raw labels. Two model misses, two guard over-abstentions and one cropped-source-span rejection remained. The v1/v2 Unknown context contracts differed, so their contract scores are not directly comparable. [Per-case audit](artifacts/model-check/EXPOSED-V2-RESULTS.md). |
| v2 fresh parent set | 2/8 delivered labels, 1/8 contracts; 5/8 raw labels and one accepted false contradiction. An opened shipping carton was confused with the retail package, alongside model misses and guard over-abstentions. The supplied expectations were not rewritten. These eight cases are now exposed. [Per-case audit](artifacts/model-check/INDEPENDENT-V2-RESULTS.md). |

Those failures motivated stopping automated verdict expansion. They do not establish v3 retrieval quality. The isolated Riverlight budget fixture uses trusted integer cents separately from model evidence: $34 + $4 = $38, then $39 + $4 = $43 after an edit. It does not parse seller text for checkout prices or ask the model to calculate money. Its persistent stale-review/approval tests use a labeled provider mock.

Frozen v1/v2/v3 source, schemas, exact inputs, raw responses and per-case failures remain in `artifacts/model-check/`. [V2 delivery provenance](artifacts/delivery-v2.json) and [v3 provenance](artifacts/delivery-v3.json) are included; original ZIPs remain byte-for-byte under `deliveries/v2/` and `deliveries/v3/` outside the current archive. All v3 browser originals remain under `artifacts/browser/v3/`; the on-disk `frozen-v3/` mirror is also preserved. Packaging verifies each identical mirror and includes those bytes once under the original v3 paths, retaining unique archived QA scripts. The unchanged task-3 benchmark is background feasibility work, not this implementation's evaluation. These are small English synthetic sets, not production benchmarks.

The optional browser runner uses existing Playwright with `chromiumSandbox:true`; another authorized machine can set `PLAYWRIGHT_MODULE_PATH` and `CHROME_PATH`. Initial plugin/CUA failures and the narrowly reviewed execution route remain in [ROUTE.md](artifacts/browser/ROUTE.md). `--mock-ui` uses branded isolated MOCK visual fixtures, makes no provider/model calls and contains no completed mock capture. `--merchant-edit` deliberately changes a persistent listing; use a fresh demo database. Actual v4 browser flow passed 24/24 with two Qwen reviews and a stale/fresh merchant edit; MOCK rendering passed 43/43, including version-specific six/seven-excerpt and historical three-excerpt limits. Desktop/mobile screenshots were inspected. [Current QA ledger](artifacts/browser/v4/QA.md). Preserve actual and mocked results separately. Never expose a tunnel, alter firewall/binding or disable Chromium's sandbox to obtain access.

## Secure PayPal setup gate

The adapter implements official [standard Checkout](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard), [Orders v2](https://developer.paypal.com/api/orders/v2/orders-create) and [idempotency guidance](https://developer.paypal.com/api/rest/reference/idempotency). It hardcodes `https://api-m.sandbox.paypal.com`, accepts approval redirects only to `https://www.sandbox.paypal.com`, and uses server create/get/capture. It persists create/capture request IDs before provider calls, checks expected amount/currency/reference and a single final capture, and retains ambiguous outcomes conservatively. The client supplies neither prices nor paid state. No live host is configurable.

Before enabling it on another machine, obtain explicit user authorization to use sandbox merchant credentials and perform sandbox create/capture tests. Supply the sandbox client ID and secret through protected local setup based on [.env.example](.env.example). Credentials must stay out of chat, screenshots, source control and delivery archives. Set `PAYPAL_SANDBOX_ENABLED=true` only after that authorization. Buyer approval remains a separate PayPal sandbox action. In the current continuation, the user authorized setup from the existing Developer sandbox application, confirmed their independent review, and delegated the remaining fictitious-account tests. Protected local `.env` is configured and enabled. During sandbox testing, no accounts were created and no real-money payment was made. Four actual sandbox orders cover two completed $48.00 captures, an uncaptured cancellation and one official provider negative-testing simulation. The simulated decline produced conservative ambiguity rather than a paid receipt; alternate-funding restart was not implemented or verified. The source repository and captioned YouTube demo are public, and [Second Look](https://devpost.com/software/second-look-x5nt6q) has been submitted to the PayPal AI Hackathon.

### Sandbox setup on a fresh judge machine

Use your own free PayPal sandbox application and generated test accounts. Your regular PayPal login is only for access to the [Developer Dashboard](https://developer.paypal.com/dashboard/) in this prototype. The checkout buyer uses a separate, fictitious Sandbox Personal login and simulated funds.

1. Sign into the Developer Dashboard and select **Sandbox**. Under **Testing Tools > Sandbox Accounts**, use the generated **Business** account for the merchant and **Personal** account for the buyer. If absent, select **Create Account**, choose the required type and country, and create each test account. PayPal documents the roles and generated accounts in its [sandbox account guide](https://developer.paypal.com/sandbox-testing/accounts).
2. Under **Apps & Credentials**, keep **Sandbox** selected. Select the default REST app or choose **Create App**, enter a name, select **Merchant** if offered, and associate your Sandbox Business account. Obtain this app's sandbox client ID and secret privately. See [REST API setup](https://developer.paypal.com/api/rest/) and [sandbox app creation steps](https://developer.paypal.com/platforms/disputes/set-up/); no disputes feature or webhook setup is needed by Second Look.
3. Return to the Sandbox Personal account's **⋮ > View/Edit Account** details and keep its generated email/password privately for the checkout sign-in. These are test credentials, not your regular PayPal login. [PayPal's sandbox login instructions](https://developer.paypal.com/api/rest/) describe this separation.
4. If `.env` does not already exist, make a local copy of [.env.example](.env.example). Restrict its file read permissions to your OS account and edit it with a local editor. Fill `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from your own sandbox app; after authorizing sandbox tests, set `PAYPAL_SANDBOX_ENABLED=true`. Keep credentials out of chat, terminal commands/history, source control, screenshots and archives. `.gitignore` excludes `.env` files and `.data`; the delivery script rejects these credential files and logs. No shared merchant secret is needed for judging.
5. Start or restart `node --env-file-if-exists=.env server.mjs` to load the local configuration and open `http://127.0.0.1:4310`. Complete the listing review and independent acknowledgement, create a sandbox order, and verify the approval page is on `www.sandbox.paypal.com`. Sign in there with the generated **Sandbox Personal** email/password, approve using test funds, return to the app and explicitly request capture. Use only the sandbox buyer at checkout; do not enter a real card or bank account. Inspect the receipt's amount, saved listing/version and separate provider/capture statuses; only a verified completed capture is paid.

## Structure and limits

- `server.mjs`: loopback HTTP, signed HttpOnly session cookie, same-origin CSRF and strict field/body/static-file guards.
- `lib/catalog.mjs`, `lib/brand.mjs`: six synthetic listings and central name/merchant configuration.
- `lib/evidence.mjs`: bounded local Qwen retrieval, source-span IDs, fixed question IDs and mechanical integrity validation; no semantic buying verdicts.
- `lib/store.mjs`, `lib/service.mjs`, `lib/paypal.mjs`: SQLite snapshots, version/payment state machine, persistent leases/idempotency and sandbox adapter.
- `public/`: dependency-free DOM modules, original SVG art and accessible responsive CSS.
- `tests/`, `scripts/`, `artifacts/`: labeled fixtures, reproducible checks, historical evidence and current results/blockers.

Suggestions can miss a relevant sentence, exclude important context or select the wrong component. Full listing review and independent judgment remain necessary. Neither seller text nor illustrations authenticate an item. English instruction detection is incomplete; multilingual and real merchant text are untested. The merchant editor is a controlled demo, not a production authorization system. There are no webhooks, fulfillment, seller onboarding or production reconciliation workers. Do not begin another purchase while capture is unresolved.

Original code, fictional text and SVG art use the [MIT license](LICENSE). Models and optional runtimes retain separate licenses; see [NOTICES.md](NOTICES.md).
