# Focused v4 evidence change

Written plan and preservation preceded implementation. The change addresses general v3 retrieval weaknesses with one bounded model call: select wording that explicitly states or qualifies requested facts, leave unstated facts unresolved, cover distinct relevant aspects and important exclusions/current corrections, and avoid unrelated category/appearance/contact wording. Questions remain optional; the prompt reserves scope questions for actual referent ambiguity and clarification for unresolved facts.

The source contract is still `quote-suggestions`, with exact server-owned span IDs and fixed neutral question IDs. The only structural increase is six suggestions per complete requirement, replacing three. Requirements remain at most three; source inventory remains at most 32; Qwen remains fixed with 4096 context and 600 output tokens. There is no semantic lexical classifier, generated question text, requirement verdict, fact inference, arithmetic, second call, tool action or payment change. Integrity acceptance still cannot establish relevance, coverage, completeness, authenticity or truth.

Four differently worded development examples use unrelated subjects and requested facts. They are explicitly development material, not fresh independent evaluation. Fifteen current v4 mocked tests exercise six-span/three-row bounds, exact mapping, empty selection, schema rejection, exclusions, Unicode identity, single-call bounded transport, unavailable/incomplete/tool/oversize/timeout states and the serialized queue. They do not measure semantic retrieval quality. Current engine checks passed 15/15; historical v3 engine and runner checks passed 28/28 alongside them. Root's full suite subsequently passed 154/154, retaining historical tests as historical, with five actual HTTP checks and no provider/model calls in those tests.

Historical v3 evidence and first raw evaluation remain byte-identical. Historical tests import the archived v3 module. The runner defaults to v4 and explicitly imports the corresponding frozen archive; `--evidence-version v3` still uses the v3 archive. The original v3 runner/helper bytes were saved under `artifacts/model-check/v3/*-original.mjs` before adapting routing. Gold criteria remain report-only; mechanically accepted exact quotations remain separate from per-requirement human semantic assessment. V4 has a separate companion rubric, preserving the v3 rubric unchanged.

Identity at handoff, before any v4 model inference:

| Item | SHA256 |
| --- | --- |
| V4 module/validator | `77a7c8d011b40a162fbff34472f6ed5cceb19b57612c2f5dee98e79742b20c42` |
| V4 prompt | `c7ad604f29f07a66e56ace0a1c5d9ff4d2cbff4d2aabc2314e1139818de2e43a` |
| V4 base schema | `f2c2a89da8fdf32eaa0115e5acf0765d66f89f05e8dd13c7efcb5761b81b2e5c` |
| Fixed question catalogue, unchanged | `8b7d6420d0453afa90fedf9e8b4e9123f4e063e1e16a378d23b7ae8017d81d9c` |
| Preserved v3 evidence | `97b5d56012cb40331ddd87f5b7af24d459cefe5c37aa25a5ff5c72fd4d66e130` |
| Preserved v3 first evaluation | `73077891b6664e22047588ebbf6e264307c10021aa58d340426c66e88940da95` |
| Preserved v3 ZIP | `4d4e5452deb059cc6d1743e182a668c19d836209d2f36c3a6a1f7f7f6022d756` |

Remaining validation at this handoff: root will freeze the audited source before any inference, run the exposed six once as development regressions, then reveal and evaluate a small independently authored fresh set once. Human audit must retain omissions, irrelevant selections and generic-question limitations rather than convert exactness into accuracy. No v4 inference was made by the evidence agent. Real PayPal sandbox checkout remains a separate secure-setup/authorization gate.
