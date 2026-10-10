// Explicit freeze artifact only: no model request, service startup or network access.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EVIDENCE_VERSION, MODEL, EVIDENCE_SCHEMA, SYSTEM_PROMPT, EVIDENCE_LIMITS, QUESTION_TEMPLATES, schemaForRequirements } from '../lib/evidence.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const folder = 'artifacts/model-check/v4';
if (EVIDENCE_VERSION !== '2026-10-10-v4') throw new Error('This freeze records v4 only.');
const source = await readFile('lib/evidence.mjs');
const frozen = {
  version: EVIDENCE_VERSION, model: MODEL, frozenAt: new Date().toISOString(),
  moduleSha256: sha(source), validatorSha256: sha(source), promptSha256: sha(SYSTEM_PROMPT),
  schemaSha256: sha(JSON.stringify(EVIDENCE_SCHEMA)),
  questionCatalogueSha256: sha(JSON.stringify(QUESTION_TEMPLATES)),
  requestSchemaSha256: [1, 2, 3].map((count) => ({ requirements: count, sha256: sha(JSON.stringify(schemaForRequirements(count))) })),
  limits: EVIDENCE_LIMITS,
  mockedTests: { currentV4Engine: 15, historicalV3Engine: 20, historicalV3Runner: 8, completeSuite: 154 },
  note: 'Frozen before all v4 live inference and before independently authored v4 cases are revealed. V3 six-case exposed regressions will run once against this same immutable revision. Historical source, inputs, raw results and delivery archives remain preserved.',
  policy: 'One bounded Qwen call selects up to six exact immutable source IDs and fixed optional neutral question IDs. Prompt targets explicit requested aspects and qualifiers with empty selection when unstated. Mechanical checks do not establish semantic relevance, completeness, authenticity, truth or approval. Full seller text and independent human acknowledgement remain required. No lexical semantic classifier, buying verdicts, new tool actions or payment changes.',
};
await mkdir(folder, { recursive: true });
await writeFile(`${folder}/evidence.mjs`, source, { flag: 'wx' });
await writeFile(`${folder}/schema.json`, JSON.stringify(EVIDENCE_SCHEMA, null, 2) + '\n', { flag: 'wx' });
await writeFile(`${folder}/prompt.txt`, SYSTEM_PROMPT + '\n', { flag: 'wx' });
await writeFile(`${folder}/identity.json`, JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
await writeFile('artifacts/model-check/freeze-v4.json', JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(frozen, null, 2));
