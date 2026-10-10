// Explicit freeze artifact only: no model request, service startup or network access.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EVIDENCE_VERSION, MODEL, EVIDENCE_SCHEMA, SYSTEM_PROMPT, schemaForRequirements } from '../lib/evidence.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const folder = 'artifacts/model-check/v2';
const source = await readFile('lib/evidence.mjs');
const frozen = {
  version: EVIDENCE_VERSION, model: MODEL, frozenAt: new Date().toISOString(),
  moduleSha256: sha(source), validatorSha256: sha(source), promptSha256: sha(SYSTEM_PROMPT),
  schemaSha256: sha(JSON.stringify(EVIDENCE_SCHEMA)),
  requestSchemaSha256: [1, 2, 3].map((count) => ({ requirements: count, sha256: sha(JSON.stringify(schemaForRequirements(count))) })),
  mockedTests: { currentV2: 22, preservedHistoricalV1: 50, runnerControlFlow: 3 },
  note: 'Frozen after general source-audit and development regressions, before any v2 model request or exposure to the new parent independent set. V1 source, original input fixture and first raw reports remain preserved.',
  policy: 'Unknown may retain exact eligible relevant context; valid means quote integrity only. Unsupported known proposals remain visible as withheld conclusions. Instruction-governed spans and general decision claims are excluded with a bounded notice. Conservative bounded English guards are not a semantic proof or authentication.',
};
await mkdir(folder, { recursive: true });
await writeFile(`${folder}/evidence.mjs`, source, { flag: 'wx' });
await writeFile(`${folder}/schema.json`, JSON.stringify(EVIDENCE_SCHEMA, null, 2) + '\n', { flag: 'wx' });
await writeFile(`${folder}/identity.json`, JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
await writeFile('artifacts/model-check/freeze-v2.json', JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(frozen, null, 2));
