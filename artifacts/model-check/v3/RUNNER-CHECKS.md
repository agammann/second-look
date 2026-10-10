# Frozen v3 runner handoff

`scripts/check-model.mjs` defaults to the quote-first v3 runner. Historical `--evidence-version v1` and `v2` dispatch to the preserved classification runner, which imports the respective archived evidence module. They do not use the current v3 module.

The reusable v3 runner checks current and archived module, prompt, schema and fixed question catalogue against `freeze-v3.json` before inference. It reserves a new output file with exclusive creation before any network call. It requires explicit isolated ownership and an empty model preflight, reads the existing manifest/quantization, and unloads owned model use in `finally` even after a failed attempted request. It never starts or stops an Ollama service.

Parent JSON is mapped without normalizing, trimming or splitting requirements. Only exact description and requirements enter `analyzeListing`. Essential quotations, question examples and pitfalls remain report-only human criteria. Actual bounded raw responses and requests, accepted rendering checks, validation failures and pending semantic audit dimensions remain separate. Source integrity cannot establish relevance, completeness, truth or buying approval.

The first independent six-case run was executed by the parent's minimal frozen-engine harness while the reusable runner was completed. Its unchanged first output is `../independent-quote-v3-first.json`; this reusable runner did not execute or rerun those cases. The six cases are now exposed. Any later use must be labeled `exposed-regression`, with no fresh accuracy claim. No additional v3 model requests were made by the evidence agent.

Verification:

- 20 current evidence mechanical/transport mocks and eight current runner/mapping mocks passed together: 28/28. No model, service or provider calls.
- The three historical runner mocks also passed: 11/11 runner checks across current and historical runners.
- Independent read-only audit cleared source mapping, gold isolation, frozen routing, ownership/cleanup and scoring separation. Historical archived evidence and reports remain unchanged.

Frozen source and reusable runner SHA256:

| File or input | SHA256 |
| --- | --- |
| Current and archived v3 evidence | `97b5d56012cb40331ddd87f5b7af24d459cefe5c37aa25a5ff5c72fd4d66e130` |
| Prompt | `3249ce0fcdb46fbfd6c91e5ca341a43094f672e4938a8fbc9e95f352756b6e99` |
| Base schema | `332423f3c2bc795c51d5060d3d09caaf123a74dc48aef2afc31a77b5c80992bc` |
| Fixed question catalogue | `8b7d6420d0453afa90fedf9e8b4e9123f4e063e1e16a378d23b7ae8017d81d9c` |
| `scripts/check-model-v3.mjs` | `e7ead86ab26e9ff81da7804bbbaa633794ce2872d961c6a218788bdb1f6384f9` |
| `scripts/quote-retrieval-integrity.mjs` | `6de3b86fac8d01e10ee7b6811d50ed469a5273958ddd5805cbc3b460a70a18af` |
| Parent raw six-case JSON | `384f51fb5ad6667e4b446924c6d0fc55a8d50926312cc28a3c5a4810e6920e87` |

Future exposed-case command, only after new explicit exclusive model handoff and with a new output path:

```powershell
node scripts/check-model.mjs --evidence-version v3 --evaluation exposed-regression --dataset tests/fixtures/independent-quote-v3-raw.json --provenance artifacts/model-check/independent-quote-v3-input-provenance.json --owns-model-use --output artifacts/model-check/exposed-quote-v3-later.json
```

This command has not been run. Real sandbox checkout remains outside this evidence task and requires the separate secure setup and user authorization.
