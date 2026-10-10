# Internal Qwen check: frozen v1

The first live internal run completed on 2026-10-10 at 00:04:46 UTC and exited with failures. **The frozen pipeline passed 14/24 requirement contracts and 4/12 whole cases. It is not a readiness pass.** Raw output, expected evidence, validation reasons and timing are preserved in [internal-holdout-v1-live.json](internal-holdout-v1-live.json). No module, prompt, case expectation or raw result was changed for this audit.

These are internal English synthetic cases authored alongside the implementation. The authoring subtask inherited the earlier benchmark report and failure summaries, although it did not open benchmark case files. This dataset is not the parent independent unseen holdout, which remains pending. Seller statements do not prove authenticity, provenance or truth.

## Counts and the distinction between model and pipeline

| Measure | Result |
|---|---:|
| Cases / buyer requirements | 12 / 24 |
| Actual model requests / successful responses | 11 / 11 |
| Hostile-text case withheld before inference | 1 case / 1 requirement |
| Frozen pipeline labels correct | 21/24 |
| Frozen pipeline full contracts | 14/24 |
| Entire cases passing every contract | 4/12 |
| Accepted false matches / false contradictions | 0 / 0 |
| False unknowns introduced by guards | 3/15 expected known decisions |
| Unavailable results / attempts without response | 0 / 0 |
| Raw model labels correct, before validation | 23/23 |
| Raw emitted quote strings copied exactly from source | 22/22 |
| Raw unknown rows with forbidden nonempty quotes | 7/8 |

All 11 responses were complete JSON with the expected indexes/status/quote fields and `done_reason: stop`. All 15 raw known decisions had semantically adequate descriptive seller evidence in this small set. One joined two sentences into one quote string, failing the frozen sentence-unit validator and predeclared acceptable-quote string. There were no fabricated, altered or shortened source quotes. Exact copying alone is not semantic validation.

The runner's `modelOnly` section reports **postvalidation** results from actual responses: 20/23 correct labels and 13/23 contracts. It is not a raw-model accuracy score. The raw labels above do not excuse the seven empty-array contract violations or replace the frozen pipeline scores.

## Every case

M = match, C = contradiction, U = unknown. The delivered U results marked invalid always had quotes discarded.

| Case | Expected / raw model | Delivered | Contracts | Time | Finding |
|---|---|---|---:|---:|---|
| fh01 | M,M,M / M,M,M | M,M,M valid | 3/3 | 4355 ms | Adequate edition, box and manual statements. First model load. |
| fh02 | C,C / C,C | C valid; U invalid | 1/2 | 1564 ms | Manual contradiction is semantically correct; combined-sentence quote rejected by guard. |
| fh03 | U,U / U,U | U,U invalid | 0/2 | 1189 ms | Correct omission labels, both returned forbidden nonempty quotes. |
| fh04 | U,U / U,U | U,U invalid | 0/2 | 1563 ms | Correct uncertainty labels, both returned forbidden nonempty quotes. |
| fh05 | U,M / U,M | U invalid; M valid | 1/2 | 1604 ms | Uninventoried contents label correct, unknown quote forbidden; box evidence adequate. |
| fh06 | U / no inference | U untrusted | 1/1 | 0 ms | Instruction trap prefiltered; this is not a model injection-resistance success. |
| fh07 | M,C,U / M,C,U | M,C valid; U invalid | 2/3 | 1884 ms | Edition/replacement evidence adequate; uncounted accessories unknown quote forbidden. |
| fh08 | M,C / M,C | U invalid; C valid | 1/2 | 1487 ms | Correct original-edition match rejected by negated replacement-word guard. |
| fh09 | M / M | M valid | 1/1 | 869 ms | Freeform functional requirement supported by the exact complete sentence. |
| fh10 | C,C / C,C | C,C valid | 2/2 | 1321 ms | Explicit box/stand absence evidence adequate. |
| fh11 | U / U | U invalid | 0/1 | 1312 ms | Correct unresolved-conflict label, but returned a forbidden three-sentence quote. |
| fh12 | M,C,U / M,C,U | U invalid; C,U valid | 2/3 | 1856 ms | Correct named-contents match rejected by clause scoping; material/edition decisions adequate. |

## Three guard-induced false unknowns

- **fh02, original manual:** raw C quoted `The original manual is missing. A folded care sheet is supplied instead.` This is an exact contiguous substring containing two complete sentences, with adequate contradiction evidence and useful replacement context. The validator accepts individual sentence units, so it rejected this joined string. Its generic rejection reason mentions missing/altered/shortened text; none occurred here. This is a quote-layout mismatch and conservative guard false unknown, not a model label error or invented quote.
- **fh08, original first edition:** raw M quoted `This is not a reissue; it is the original first edition.` The evidence correctly negates reissue and positively asserts the required edition. The guard treats the `reissue` keyword as incompatible without recognizing its negation, producing U/invalid. This is a developer guard error.
- **fh12, named contents:** raw M quoted `All six named pieces are included: figure, stand, lantern, badge, map, and printed manual.` Every requested piece is explicitly included. Clause scoping selects the manual clause after `and`, drops the governing `All`, and then rejects completeness. This is a developer guard error.

## Seven model empty-array violations

Unknown must have `quotes: []`. The model instead supplied nonempty exact-source quotes for fh03 requirements 1 and 2, fh04 requirements 1 and 2, fh05 requirement 1, fh07 requirement 3, and fh11 requirement 1. Their raw U labels were semantically correct: omissions, hedged origin, uncounted inventory and unresolved conflict remain unknown. The validator visibly marked each invalid and discarded every quote. These are model output-contract failures, not false contradictions, and remain failures in the reported score.

## Duration, cleanup and frozen identities

Median wall duration was **1.563 s across 11 model calls**, including the first unloaded-model request. The subsequent 10 calls had median **1.525 s**, range 0.869–1.884 s. The first call took 4.355 s, with runtime-reported load 2.598 s. The 0 ms prefilter case is excluded from these model timings. These short listings and small repeated local run do not establish long-input or concurrent performance.

Preflight confirmed no resident models. Cleanup attempted unloading only the owned fixed Qwen model and confirmed `residentAfter: []`, `unloaded: true`. No unavailable requests were hidden.

The raw run identities, [freeze-v1.json](freeze-v1.json), and current files agree:

- Module SHA-256: `b004c705e47eacc9bbcd62278ba0dfcad7169b482329d203854ffee5d9af051a`
- Prompt SHA-256: `dae3c83244874e57c643c1394e9d1305d057ecedc4bdf011010ebf504fe62693`
- Dataset SHA-256: `37f7d1f9908ab405060d03878a70f116ac3963c295c3bbc52ebd729abb049d38`

Frozen v1 is unchanged. Any later change informed by these failures must be a new disclosed version; this internal set then becomes regression evidence. The parent independent holdout and real sandbox checkout remain separate pending gates.
