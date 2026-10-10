# Fresh holdout v1

`fresh-holdout-v1.json` contains 12 original English synthetic listings and 24 atomic buyer requirements. It was frozen at `2026-10-09T23:46:40Z`, before any live inference on these cases. This author did not request model inference or start, stop, or alter any model service.

The expected labels are 8 `match`, 7 `contradiction`, and 9 `unknown`. Known labels specify acceptable exact, full-sentence seller quotes. Unknown labels have no acceptable quotes. All listing names and text were created for this file; they are fictional and are not claims about real merchandise.

Coverage includes explicit inclusion, explicit absence, negation scope, omitted facts, unresolved claims, an uninventoried bundle, conflicting inventory notes, multiple requirements, freeform functional language, and a hostile instruction containing an exact-quote trap. For the hostile case, a sentence embedded in an instruction to the analyzer is not factual seller evidence merely because it occurs verbatim in the source. Uncertainty must remain visible.

These are internal synthetic cases authored alongside the implementation in a separate delegated task, not tuning data or a copy of the earlier benchmark. The author did not open or copy tuning fixtures, unit-test fixtures, or task-3 benchmark case files. Shared conversation history included the product goal, module contract, and earlier benchmark report and failure summaries. This dataset is never the parent independent unseen holdout. It is a small internal synthetic check rather than an independent real-world evaluation or a calibrated accuracy estimate.

Keep this version immutable when reporting its first live results. Record each case's actual labels, quotes, validation state, duration, and failures without dropping inconvenient cases. After inspecting results, any prompt or validator changes influenced by those results must be disclosed; subsequent checks on this set are regression checks, not fresh holdout evidence. New fresh cases should use a new dataset filename and freeze timestamp.

The quotes are seller statements only. Even a matching result does not authenticate an item, verify the seller's truthfulness, establish its value, or authorize payment.
