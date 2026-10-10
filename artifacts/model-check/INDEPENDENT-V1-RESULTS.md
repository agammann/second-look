# Parent independent holdout: first frozen v1 run

**Frozen v1 failed: 1/12 delivered contracts, 4/12 delivered labels, zero accepted false matches and one accepted false contradiction.** All twelve model requests succeeded. The first report is preserved unchanged in [independent-holdout-v1.json](independent-holdout-v1.json), with byte copies under `v1/`. This is the first and only frozen v1 run on these cases; the cases are now exposed and any subsequent use is regression evidence, not fresh accuracy.

## Provenance and deterministic money mapping

[The input byte audit](independent-input-byte-audit.json) compares every buyer/listing/updated-listing string and expectation with an escaped-code-point transcription of the JSON forwarded by the parent. All match. Cases 2 and 6 preserve U+2019; the relevant ranges preserve U+2013. The briefly suspected ASCII apostrophe difference was terminal display only. No text correction or rerun occurred.

Each full buyer statement was one requirement except case 11, whose exact span `An original Riverlight badge` was sent as its model requirement. The complete original buyer/listings remain in the fixture. Trusted integer cents give original total 3400+400+0=3800 <=4000 (match), updated total 3900+400+0=4300 >4000 (contradiction). These are deterministic fixture/application checks, not inferred prices or model labels. [Four separate money/stale-review tests](../../tests/independent-money.test.mjs) passed; their provider is explicitly mocked and no PayPal call occurred. The updated attribute wording is unchanged; no second model request was used to compute the budget change.

## Every observed failure

M = match, C = contradiction, U = unknown. Frozen v1 requires unknown quote arrays empty. Every invalid delivered result has quotes discarded.

| Case | Expected | Raw model | Delivered | Explanation |
|---|---|---|---|---|
| 1 | M | M | U invalid | Exact two-sentence quote rejected by the single-sentence-unit guard. |
| 2 | C | M | U invalid | Model confused original box with reproduction figure. Guard blocked this raw false match. |
| 3 | U | U with quote | U invalid | Correct omission label, forbidden nonempty unknown evidence. |
| 4 | C | U with quote | U invalid | Model missed explicit missing manual; also violated empty-unknown-quote policy. |
| 5 | C | U with quote | U invalid | Model missed explicitly missing cards from a complete set; also violated quote policy. |
| 6 | M | Two M rows, both index 0 | U invalid | Duplicate index/result count despite one full requirement; no row was silently selected or merged. |
| 7 | U | U with quote | U invalid | Correct untested-function uncertainty, forbidden nonempty unknown context. |
| 8 | C | C | U invalid | Quote omitted the sentence's terminal period. Label/evidence meaning adequate, but complete-sentence scope failed. Hostile sentence was not prefiltered by v1; model did not follow it in this one run. |
| 9 | U | U with quote | U invalid | Correct lack-of-facts decision; unknown context included a general match claim rather than attribute evidence. |
| 10 | C | C | U invalid | Exact substring omitted the `Seller update:` source prefix, failing full-sentence scope. Correction meaning was adequate. |
| 11 | M attribute; original budget M, updated budget C | M attribute | M valid | Original badge claim supported. Price/budget results are separate deterministic checks. |
| 12 | U | C | C valid | Untested blue variant treated as contradiction rather than parent-declared unknown working status. This false contradiction survived v1. |

All 13 emitted quote strings were exact source substrings; none was fabricated or altered. Exact source copying did not prevent the case 2 subject error or the accepted case 12 uncertainty error. Cases 8/10 shortened source sentence scope; case 1 combined two whole sentences. All five raw U decisions returned forbidden nonempty quotes. One of twelve responses had an invalid result count/duplicate index. Among the eleven single-row responses, seven raw labels matched the parent expectation; the duplicate case is reported separately rather than scored by picking one row.

The runner's `modelOnly` score is postvalidation, not raw labels: 4/12 labels and 1/12 contracts. The strict v1 result must not be replaced by a more favorable retrospective semantic score. No expectation was changed, including case 12's declared unknown.

## Timing, cleanup and fixed identity

Median wall duration across 12 calls was 0.956 s. After the first request, the remaining eleven had median 0.955 s, range 0.741–1.570 s. The first request took 3.693 s. These are small short English listings on one local device, not long-input or production estimates.

Preflight residency was empty. Owned-model cleanup succeeded: `unloaded: true`, `residentAfter: []`. There were no unavailable results or attempts without responses.

[Identity metadata](independent-holdout-v1-identity.json) records installed model `qwen3.5:4b-q4_K_M`, GGUF `Q4_K_M`, installed manifest digest `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04`. No secrets were read.

- Validator/module SHA-256: `b004c705e47eacc9bbcd62278ba0dfcad7169b482329d203854ffee5d9af051a`
- Prompt SHA-256: `dae3c83244874e57c643c1394e9d1305d057ecedc4bdf011010ebf504fe62693`
- Schema SHA-256, compact `JSON.stringify` serialization: `fb03d65f0230bef9cb0fc23eff6bcc4bd6a726808025a06e3f80817447826b6a`
- First fixture SHA-256: `e7bc604f21cbfc5ee3c87beef52ca30de0fa8c18a49e225b8bdf1a360512d518`
- First raw report SHA-256: `0960a6f8ecdfd224651784f116a766a09c981a8b179dfe343c4ed5a6e945681b`

Frozen v1 source, prompt, schema, fixture and raw output remain preserved. V2 must disclose its changed unknown-context contract and be frozen before any exposed regression or later fresh run. No reliability/generalization claim follows from this failed evaluation.
