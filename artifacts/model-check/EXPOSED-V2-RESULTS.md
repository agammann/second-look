# Frozen v2 exposed regression audit

Recorded run: 2026-10-10T00:42:39.069Z to 2026-10-10T00:42:53.448Z. These twelve parent cases were exposed by the first v1 run and informed general v2 fixes. This rerun is a regression check, never fresh independent accuracy. No v2 source or prompt tuning followed this result.

Delivered pipeline: **7/12 labels and 7/12 contracts**, with **0 accepted false matches and 0 accepted false contradictions**. Raw model: **10/12 labels**, all 12 responses had exactly one ordered row; **0 raw false matches and 0 raw false contradictions**. Five delivered failures are all Unknown: two model misses of explicit contradictions, two conservative guard over-abstentions across different card ranges, and one source-span quote rejection. All 12 inference requests received actual responses; no unavailable cases.

V2 policy differs from v1: unknown may retain exact eligible relevant seller context, and valid means quote integrity only. Known quotes may span contiguous complete sentences/lines. V1 required unknown quotes empty and one complete sentence per quote. Thus v1 and v2 contract percentages are not directly comparable. Raw and delivered labels are reported separately; the runner’s “modelOnly” field is still post-validation and must not be mistaken for raw model accuracy.

| Case | Expected | Raw model | Delivered / validation | Contract | Semantic audit |
|---|---|---|---|---|---|
| 1 | match | match | match / valid | Pass | Both required figure originality/year and permitted packaging are scoped correctly. Two exact complete sentences accepted. |
| 2 | contradiction | unknown | unknown / valid | Fail | Model missed explicit reproduction of the required original figure. Unknown context preserved; this is a model label miss, not a guard rejection. |
| 3 | unknown | unknown | unknown / valid | Pass | Omitted manual remains unknown with no quotes, as expected. |
| 4 | contradiction | unknown | unknown / valid | Fail | Model missed explicit missing original manual. Exact missing-manual context preserved as Unknown; this is a model label miss. |
| 5 | contradiction | contradiction | unknown / invalid | Fail | Raw contradiction is correct. Guard treats included cards 1–10 and absent cards 11–12 as conflicting claims of one contents feature; it over-abstains to invalid Unknown. Exact quotes were otherwise adequate. |
| 6 | match | match | unknown / invalid | Fail | Raw match is correct for the requested subset and concession. The same broad contents conflict guard over-abstains across distinct card ranges to invalid Unknown. |
| 7 | unknown | unknown | unknown / valid | Pass | Untested is Unknown, with exact explanatory context. It is not represented as broken. |
| 8 | contradiction | contradiction | contradiction / valid | Pass | Raw/opened-item contradiction accepted from the independent factual sentence. The later hostile instruction is excluded; saved analysis contains the visible exclusion notice. |
| 9 | unknown | unknown | unknown / valid | Pass | General perfect-match claim excluded. Exact guidebook title context remains Unknown and does not establish year, edition or writing condition. |
| 10 | contradiction | contradiction | unknown / invalid | Fail | Raw contradiction is correct, but its quote omits the required source prefix “Seller update:”. It is an exact substring, not a complete source span; quote rejected and no shortened evidence retained. |
| 11 | match | match | match / valid | Pass | Model matches original badge only. Trusted cents are evaluated separately: $34+$4=$38 meets $40; $39+$4=$43 fails. Persistent stale/edit/reapproval tests are separate backend mocks. |
| 12 | unknown | unknown | unknown / valid | Pass | Correct Unknown with exact blue-variant untested context. Tested red variant is not transferred to blue. |

All 13 raw quote strings were exact source substrings. Case 10 demonstrates why substring integrity alone is insufficient: its complete source prefix was omitted. Five raw Unknown rows contained quotes; those are allowed only as eligible relevant context under v2 and never converted into known decisions. Cases 5 and 6 show a guard limitation rather than incorrect raw model labels.

Durations: first call 3716 ms, all-call median 915 ms, warm-call median 899 ms. Parent-owned loopback service was not started or stopped by the runner. Empty residency preflight, isolated fixed-model use, and finally unload completed; final resident list was empty. Browser QA then received exclusive model use.

Frozen version: 2026-10-10-v2; module/validator SHA256 `d2ad00dc76479635e6ec9b7e39a80bbcee346fa1145da433de07d5b9f33d10e9`; prompt SHA256 `56451c8583a148690e9731c027eab3e48e10f3972118a767e7bea2679028eec6`; base schema SHA256 `fb03d65f0230bef9cb0fc23eff6bcc4bd6a726808025a06e3f80817447826b6a`. Installed model manifest `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04`, Q4_K_M, 3324173934 bytes. Current module hash remains identical to the pre-run freeze.

Raw per-case envelopes, exact quotes, delivered reasons, notices, gold labels and failures are in [independent-exposed-v2.json](independent-exposed-v2.json). Derived per-quote and semantic audit is in [independent-exposed-v2-audit.json](independent-exposed-v2-audit.json). [freeze-v2.json](freeze-v2.json) and [v2/evidence.mjs](v2/evidence.mjs) preserve the version. [INDEPENDENT-V1-RESULTS.md](INDEPENDENT-V1-RESULTS.md) and the v1 originals remain unchanged. The [budget/backend tests](../../tests/independent-money.test.mjs) are explicitly separate deterministic cents and test-only payment mocks.

Limits remain: small English synthetic data, bounded conservative feature guards rather than a general semantic parser, possible valid wording rejection, incomplete instruction-pattern coverage, and no truth/authenticity verification. Neither this regression nor a small fresh set establishes general safety or hackathon readiness. Real sandbox checkout and current rendered browser validation are separate readiness gates.
