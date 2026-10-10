# Quote retrieval: human evaluation rubric

Rubric version: `quote-retrieval-v3-rubric-1`  
Frozen: `2026-10-10T01:40:04Z`  
Applicable implementation at drafting: `2026-10-10-v3` in `lib/evidence.mjs`.

This rubric evaluates retrieval of seller wording for a buyer to inspect. It does not evaluate whether merchandise satisfies a requirement, authenticate a product, verify seller statements, or recommend a purchase. Record source integrity and semantic usefulness separately. A valid selected source ID establishes only where the text came from.

## Evaluation inputs and separation

For each case, retain the full unchanged seller description, each complete buyer requirement in order, source digest and source-span inventory, raw model output, accepted output, validation state, notices, model identifier, evidence version, settings, run timestamp, and duration. Inspect the full description, including excluded and unselected passages. A nearby sentence or a later correction can change how selected wording should be read.

The module numbers source units `s1` through `s32`; IDs refer to the listing snapshot for that invocation. Source units are sentence/line slices with outside whitespace removed. If the listing exceeds the unit bound, later units are grouped into the final span. Record grouped spans and exclusion notices. The model selects at most three eligible span IDs and two fixed question IDs per complete buyer statement. Quote and question wording are then supplied by the application from those IDs.

Freeze this rubric and the implementation/settings before the parent supplies independent cases. The parent owns fresh-case authoring. Preserve v1/v2 datasets and outputs. Reruns of the previously exposed eight cases are regression checks. Changes prompted by an evaluated case make later uses of that case regression checks; retain the first output and disclose the change. Existing match/contradiction/unknown scores describe earlier classification versions and do not measure v3 retrieval adequacy.

Before reading a model output, a human reviewer should note the requirement's distinct aspects, useful seller passages, and context essential to reading those passages. Keep the original buyer statement whole, including qualifications and concessions. Multiple different span selections may be useful; this is not an exact-ID-answer benchmark. Record evaluator disagreements and unresolved judgments instead of silently resolving them in the model's favor.

## A. Mechanical integrity

Record each check as `pass`, `fail`, or `not evaluable`, with the raw and accepted result distinguished. An invalid output that the application rejects remains a raw-output failure. A service timeout remains unavailable rather than a successful empty retrieval.

| Check | Human verification |
| --- | --- |
| Snapshot identity | The preserved description, digest, span inventory, and evidence version refer to the same invocation and reviewed listing snapshot. |
| Result shape and association | Exactly one result exists for each complete buyer statement, with the correct order/index and unchanged requirement association. Record extra fields, malformed JSON, generated verdicts/text, and missing or repeated rows. |
| ID bounds and eligibility | Every selected ID exists in this inventory, is eligible, occurs once per result, and respects the selection limits. Record attempts to select excluded passages even when rejected. |
| Exact source rendering | Every displayed quote equals its selected span's application-owned text, which is the preserved description slice at its recorded offsets after outside-whitespace removal. IDs and quotes are not taken from another listing or run. |
| Fixed question rendering | Question IDs exist in the frozen catalogue, are unique and bounded, and display exactly the catalogue text. `q_scope` requires a selected span; `q_clarify` may accompany an empty selection. |
| Failure visibility | Rejected, excluded, unavailable, and empty results are labeled accurately. The displayed reason/notices do not claim that no selection proves absence of information. |

These checks do not establish semantic relevance, adequate context, truthfulness, or complete detection of hostile text. Document source segmentation or exclusion that limits useful retrieval as its own observation.

## B. Semantic retrieval adequacy

Review each complete buyer statement against the full listing. Record each dimension independently as `adequate`, `partial`, `inadequate`, or `not applicable`, with source IDs or exact text supporting the judgment.

| Dimension | Questions for the reviewer |
| --- | --- |
| Requirement aspect coverage | Do the selected passages help inspect the stated component, edition, contents, condition, function, or other requested details? Which aspects receive useful context, and which are omitted? Keep any buyer concession attached to its named component. Selection of an aspect's explicit uncertainty or absence can be useful. |
| Qualifications and corrections | Does selection include materially relevant caveats, uncertainty, alternatives, exceptions, corrections, or conflicting descriptions? Could reading the selected text alone conceal wording elsewhere that changes its meaning? Record favorable-only or unfavorable-only selection with omitted contextual IDs. |
| Component, variant, and packaging scope | Does the wording concern the exact item/component and variant requested? Distinguish displayed objects from supplied contents and distinguish an outer box, inner tray, sleeve, manual, replacement part, or other named component. Record ambiguous referents and text about other variants. A scope question does not repair a misleading selection. |
| Relevance and economy | Is each selected passage useful to inspection, or does it distract with unrelated information, broad sales language, a general preference verdict, or instruction-like text? Record unnecessarily broad/grouped selections and any useful context lost to the three-span bound. |
| Empty-selection usefulness | If nothing is selected, does the full listing lack clearly useful eligible wording, or is abstention reasonable because relevance is unresolved? If useful wording was available, record missed retrieval. If useful wording was excluded, record that limitation separately. Do not infer that the item lacks an attribute or that the listing contains no relevant information. |
| Question neutrality and usefulness | Is each fixed question useful for this requirement and selection? Does its use avoid presuming satisfaction, authenticity, completeness, a defect, or any fact not established by the displayed context? Does it preserve buyer agency and avoid payment advice? Optional omission of a question is acceptable; record any ambiguity or misleading implication caused by its placement. |

For reference, the current fixed questions are:

- `q_scope`: “Does the quoted text refer to the exact component or variant you mean?”
- `q_clarify`: “What would you like the merchant to clarify about this requirement?”

Assess the rendered combination of requirement, quotes, questions, and notices. Catalogue wording alone cannot establish contextual usefulness or neutrality. No selection, quoted uncertainty, and conflicting wording may all be appropriate outcomes without a requirement verdict.

## Per-case record and reporting

Use one record per complete buyer statement, retaining its case ID and requirement index. Include mechanical check outcomes, selected and excluded IDs, aspect coverage notes, material omissions, scope errors, empty-selection assessment, question assessment, and a brief reviewer rationale. Add case-level service/schema failures and reviewer uncertainty. Keep all cases in the report, including invalid output, timeout, and no-selection cases.

Report mechanical failures and semantic dimension judgments separately, with denominators and the per-case records. Do not turn exact-source success into a relevance or truthfulness claim, combine the dimensions into an unexplained accuracy number, or omit rejected results from the population. Describe fresh independent evaluation and exposed-case regression runs separately. This document supplies a rubric only; it contains no new test cases, inference results, or accuracy claims.
