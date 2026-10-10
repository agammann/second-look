# V4 retrieval assessment

Rubric version: `quote-retrieval-v4-rubric-1`. Written before independently authored v4 cases are revealed. The application remains text-only quote suggestions, with no requirement verdict, authentication, truth or purchasing score.

Use all mechanical checks and separate human semantic dimensions in the preserved [v3 rubric](QUOTE-RETRIEVAL-RUBRIC.md). V4 changes the selection ceiling to six exact eligible source spans per complete buyer statement. All other input limits, fixed questions and mechanical integrity principles remain unchanged. The larger bound does not establish completeness.

Before model output, record the buyer's distinct requested facts and relevant wording/qualifications against the full source. After output, assess each complete requirement separately:

- Explicit requested-fact coverage, including missing information, uncertainty, exclusions, named variants and current corrections. Record every material omission; do not grade only selected quotations.
- Direct relevance and scope. Category, appearance, contact offers and other unrelated wording cannot answer an unstated requested fact. Exact quotation alone remains insufficient. Empty selection can be appropriate; a missed relevant passage remains a failure.
- Selection economy. Retain enough distinct passages for the requested aspects and qualifications without distracting text. Record any ceiling or segmentation limitation rather than waiving it.
- Fixed-question neutrality separately from contextual usefulness. Questions are optional. Scope wording is useful only for actual referent ambiguity, and cannot repair omitted or misleading source context. Clarification can help unresolved requested facts, but is generic and makes no new premise.

Keep raw output, delivered mechanical validation, unavailable/invalid/empty states and semantic judgments separate. Use `adequate`, `partial`, `inadequate` and `not applicable` with per-requirement rationale; preserve disagreements. Do not merge exactness and semantic coverage into an unexplained accuracy number. All cases stay in denominators.

The exposed v3 six-case set is a development regression for v4. Newly authored cases must be supplied only after the v4 source/prompt/schema freeze, evaluated once, and become exposed afterward. No tuning or fresh-accuracy claims on later reuse. Money arithmetic and payment status remain deterministic application checks outside model retrieval.
