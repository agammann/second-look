/** Explicit frozen retrieval evaluation. Never starts Ollama or changes network/service settings. */
import { readFile, mkdir, open } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sha256, mapRetrievalDataset, assessRenderedIntegrity, pendingRetrievalAudit } from './quote-retrieval-integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:11434';
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const purpose = value('--evaluation', 'exposed-regression');
if (!['fresh-independent', 'exposed-regression', 'internal-synthetic', 'runner-mock'].includes(purpose)) throw new Error('Unsupported evaluation purpose.');
const datasetPath = resolve(root, value('--dataset', 'tests/fixtures/independent-quote-v3-raw.json'));
const outputPath = resolve(root, value('--output', `artifacts/model-check/quote-v3-${new Date().toISOString().replace(/[:.]/gu, '-')}.json`));
const modulePath = resolve(root, 'artifacts/model-check/v3/evidence.mjs');
const engine = await import(pathToFileURL(modulePath).href);
const { analyzeListing, validateEvidenceInput, validateModelOutput, MODEL, EVIDENCE_VERSION, EVIDENCE_LIMITS, SYSTEM_PROMPT, EVIDENCE_SCHEMA, QUESTION_TEMPLATES, eligibleSource, schemaForRequirements } = engine;
const ownsUse = args.includes('--owns-model-use');
// Reserve a new output before any network call. First reports are never overwritten.
await mkdir(dirname(outputPath), { recursive: true });
const output = await open(outputPath, 'wx');
const report = { kind: 'live-local-quote-retrieval-check', selectedVersion: 'v3', evidenceVersion: EVIDENCE_VERSION, model: MODEL,
  evaluationPurpose: purpose, datasetPath, startedAt: new Date().toISOString(), status: 'not_started',
  context: EVIDENCE_LIMITS.context, maxOutputTokens: EVIDENCE_LIMITS.outputTokens, ownershipRequested: ownsUse,
  preflight: null, cleanup: null, cases: [],
  policy: 'Mechanical source/ID integrity is separate from human semantic retrieval coverage; no label, exact-quote-only accuracy, truth or purchase verdict scoring.',
  limitations: ['Small synthetic text-only evaluation. Seller statements remain unverified.',
    'Instruction detection is bounded and incomplete; full source remains visible.',
    'Three suggestions per requirement can omit important context; all omissions remain semantic audit findings.',
    'Fixed neutral questions are generic. Neutrality and case-specific usefulness must be assessed separately.',
    'After an evaluation is exposed, future tuned reruns are regression checks.'],
};
let isolated = false;
let inferenceRequests = 0;
let successfulResponses = 0;
let currentRaw = [];
let dataset;

function errorSummary(error) {
  return { name: error?.name ?? 'Error', code: error?.cause?.code ?? error?.code ?? null,
    message: error?.cause?.code === 'EACCES' ? 'Execution environment denied loopback access.' : 'Existing approved loopback service could not complete this operation.' };
}
async function boundedText(response) {
  const reader = response.body?.getReader();
  if (!reader) { const text = await response.text(); if (Buffer.byteLength(text) > EVIDENCE_LIMITS.responseBytes) throw new Error('oversized response'); return text; }
  let size = 0;
  const chunks = [];
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > EVIDENCE_LIMITS.responseBytes) throw new Error('oversized response'); chunks.push(value); } }
  finally { if (size > EVIDENCE_LIMITS.responseBytes) await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
async function localJSON(path, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'error', signal: AbortSignal.timeout(10000), ...init });
  if (!response.ok) throw new Error('local service error');
  return JSON.parse(await boundedText(response));
}
const tracedFetch = async (url, init) => {
  inferenceRequests++;
  // Actual request contains only engine schema, source spans, exact requirements and fixed questions.
  const request = JSON.parse(init.body);
  try {
    const response = await fetch(url, init);
    if (response.ok) successfulResponses++;
    let rawBody;
    try { rawBody = await boundedText(response.clone()); } catch { rawBody = null; }
    currentRaw.push({ request, status: response.status, rawBody, rawBodyBounded: rawBody !== null });
    return response;
  } catch (error) { currentRaw.push({ request, transportError: errorSummary(error) }); throw error; }
};
function assessRaw(responses, input) {
  return responses.map((response) => {
    if (response.status !== 200 || typeof response.rawBody !== 'string') return { responseReceived: false, envelopeAccepted: false, rawRows: null, rowValidation: [] };
    try {
      const envelope = JSON.parse(response.rawBody);
      const complete = envelope.model === MODEL && envelope.done === true && envelope.done_reason !== 'length' &&
        envelope.message?.role === 'assistant' && !envelope.message?.tool_calls?.length && typeof envelope.message?.content === 'string';
      let payload;
      try { payload = JSON.parse(envelope.message?.content); } catch { payload = null; }
      const validations = complete ? validateModelOutput(envelope.message.content, input) : [];
      return { responseReceived: true, envelopeAccepted: complete, contentParsed: payload !== null, rawRows: payload?.results ?? null,
        rowValidation: validations.map((row, index) => ({ index, validation: row.validation, reason: row.reason })),
        allIdsAccepted: complete && validations.length === input.requirements.length && validations.every((row) => row.validation === 'valid') };
    } catch { return { responseReceived: true, envelopeAccepted: false, contentParsed: false, rawRows: null, rowValidation: [], allIdsAccepted: false }; }
  });
}

try {
  const datasetText = await readFile(datasetPath, 'utf8');
  const rawDataset = JSON.parse(datasetText);
  dataset = mapRetrievalDataset(rawDataset);
  if (!dataset.name) throw new Error('Missing dataset identity.');
  for (const entry of dataset.cases) {
    validateEvidenceInput(entry);
    if (!entry.id || !Array.isArray(entry.criteria.essentialQuotes) || entry.criteria.essentialQuotes.some((quote) => typeof quote !== 'string' || !entry.description.includes(quote)) ||
      !Array.isArray(entry.criteria.acceptableQuestions) || entry.criteria.acceptableQuestions.some((question) => typeof question !== 'string') ||
      (entry.criteria.acceptableQuestion !== null && typeof entry.criteria.acceptableQuestion !== 'string')) throw new Error('Invalid retrieval criteria.');
  }
  report.dataset = { name: dataset.name, rawSha256: sha256(datasetText), canonicalSha256: sha256(JSON.stringify(rawDataset)),
    caseCount: dataset.cases.length, requirementCount: dataset.cases.reduce((sum, entry) => sum + entry.requirements.length, 0),
    mapping: 'Exact listing/description and full requirements. Essential quotes, question examples and pitfalls are evaluation criteria only, never model input.',
    criteriaPreparedAt: new Date().toISOString(), criteria: dataset.cases.map((entry) => ({ id: entry.id, ...entry.criteria })) };
  const freeze = JSON.parse(await readFile(resolve(root, 'artifacts/model-check/freeze-v3.json'), 'utf8'));
  report.freeze = freeze;
  report.moduleSha256 = sha256(await readFile(modulePath));
  report.currentModuleSha256 = sha256(await readFile(resolve(root, 'lib/evidence.mjs')));
  report.promptSha256 = sha256(SYSTEM_PROMPT);
  report.schemaSha256 = sha256(JSON.stringify(EVIDENCE_SCHEMA));
  report.questionCatalogueSha256 = sha256(JSON.stringify(QUESTION_TEMPLATES));
  if (report.moduleSha256 !== freeze.moduleSha256 || report.currentModuleSha256 !== freeze.moduleSha256 ||
    report.promptSha256 !== freeze.promptSha256 || report.schemaSha256 !== freeze.schemaSha256 || report.questionCatalogueSha256 !== freeze.questionCatalogueSha256) throw new Error('Evidence identity changed since freeze.');
  report.requestSchemas = dataset.cases.map((entry) => ({ id: entry.id, sha256: sha256(JSON.stringify(schemaForRequirements(entry.requirements.length, eligibleSource(entry.description).spans))) }));
  if (args.includes('--provenance')) {
    report.inputProvenance = JSON.parse(await readFile(resolve(root, value('--provenance')), 'utf8'));
    if (report.inputProvenance.rawSha256 !== report.dataset.rawSha256 || report.inputProvenance.canonicalInputSha256 !== report.dataset.canonicalSha256) throw new Error('Input provenance hashes differ.');
  }
  let resident;
  try { resident = await localJSON('/api/ps'); report.preflight = { reachable: true, existingModels: resident.models?.map((model) => ({ name: model.name ?? model.model, digest: model.digest })) ?? null }; }
  catch (error) { report.status = 'blocked'; report.preflight = { reachable: false, error: errorSummary(error) }; report.blocker = 'Existing approved loopback service was unreachable. No startup, binding, firewall or sandbox changes attempted.'; }
  if (resident) {
    if (!Array.isArray(resident.models) || resident.models.length) { report.status = 'blocked'; report.blocker = 'Residency was not empty and verified; existing model state preserved.'; }
    else if (!ownsUse) { report.status = 'blocked'; report.blocker = 'Explicit isolated model-use ownership is required; no inference or unload attempted.'; }
    else {
      isolated = true;
      const tags = await localJSON('/api/tags');
      const installed = tags.models?.find((model) => (model.name ?? model.model) === MODEL);
      if (!installed?.digest) throw new Error('Retained fixed model identity unavailable.');
      const details = await localJSON('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, verbose: false }) });
      report.modelIdentity = { capturedAt: new Date().toISOString(), manifestDigest: installed.digest, bytes: installed.size ?? null,
        quantization: details.details?.quantization_level ?? installed.details?.quantization_level ?? null, format: details.details?.format ?? null,
        family: details.details?.family ?? null, parameterSize: details.details?.parameter_size ?? null, source: 'Read-only existing /api/tags and /api/show before inference.' };
      if (report.modelIdentity.quantization !== 'Q4_K_M') throw new Error('Fixed quantization mismatch.');
      report.status = 'running';
      for (const entry of dataset.cases) {
        // Gold remains report-only. Do not pass the full entry to the model module.
        const input = { description: entry.description, requirements: entry.requirements };
        currentRaw = [];
        const beforeRequests = inferenceRequests;
        const beforeResponses = successfulResponses;
        const analysis = await analyzeListing(input, { fetchImpl: tracedFetch });
        const integrity = assessRenderedIntegrity(analysis, input, QUESTION_TEMPLATES, EVIDENCE_LIMITS, EVIDENCE_VERSION);
        const row = { id: entry.id, ...input, inferenceRequested: inferenceRequests > beforeRequests, modelResponseReceived: successfulResponses > beforeResponses,
          raw: currentRaw, rawAssessment: assessRaw(currentRaw, input), analysis, integrity, retrievalAudit: pendingRetrievalAudit(entry.criteria) };
        report.cases.push(row);
        console.log(`${entry.id}: ${analysis.results.map((result) => `${result.validation}/${result.suggestions.length} selections`).join(', ')}; ${analysis.durationMs} ms; semantic coverage pending human audit`);
      }
      const rows = report.cases.flatMap((entry) => entry.integrity);
      const results = report.cases.flatMap((entry) => entry.analysis.results);
      const raw = report.cases.flatMap((entry) => entry.rawAssessment);
      report.summary = { cases: report.cases.length, requirements: rows.length,
        renderedIntegrityPass: rows.filter((row) => row.renderedIntegrityPass).length,
        validMechanicalRequirements: rows.filter((row) => row.renderedIntegrityPass && row.validation === 'valid').length,
        validationCounts: Object.fromEntries(['valid', 'invalid', 'unavailable', 'untrusted'].map((validation) => [validation, results.filter((result) => result.validation === validation).length])),
        emptySelections: results.filter((result) => !result.suggestions.length).length,
        attemptedWithoutModelResponse: report.cases.filter((entry) => entry.inferenceRequested && !entry.modelResponseReceived).length,
        prefilteredCases: report.cases.filter((entry) => !entry.inferenceRequested).length,
        rawResponses: raw.filter((entry) => entry.responseReceived).length, rawAcceptedResponses: raw.filter((entry) => entry.allIdsAccepted).length,
        semanticAdequacy: 'pending human per-requirement audit; not inferred from source integrity' };
      report.status = 'completed';
    }
  }
  if (report.status === 'blocked') report.cases = dataset.cases.map((entry) => ({ id: entry.id, description: entry.description, requirements: entry.requirements, status: 'not_run', retrievalAudit: pendingRetrievalAudit(entry.criteria), reason: report.blocker }));
} catch (error) { report.status = 'blocked'; report.blocker = 'Dataset, frozen evidence identity or service metadata could not be validated. No further model requests made.'; report.error = { name: error.name, message: error.message }; }
finally {
  // Empty preflight and explicit ownership are both required. A failed attempt can still load weights.
  if (isolated && inferenceRequests > 0) {
    try {
      await localJSON('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, stream: false, keep_alive: 0 }) });
      const after = await localJSON('/api/ps');
      report.cleanup = { attempted: true, ownedModel: MODEL, residentAfter: after.models?.map((model) => model.name ?? model.model) ?? null,
        unloaded: Array.isArray(after.models) && !after.models.some((model) => (model.name ?? model.model) === MODEL) };
    } catch (error) { report.cleanup = { attempted: true, unloaded: false, error: errorSummary(error) }; }
  } else report.cleanup = { attempted: false, reason: 'No isolated inference attempt; no model startup or unload.' };
  report.inferenceRequests = inferenceRequests;
  report.successfulResponses = successfulResponses;
  report.finishedAt = new Date().toISOString();
  await output.writeFile(JSON.stringify(report, null, 2) + '\n');
  await output.close();
  console.log(`Saved ${outputPath}`);
  if (report.blocker) console.log(report.blocker);
  process.exitCode = report.status !== 'completed' ? 2 : report.summary.validationCounts.invalid || report.summary.validationCounts.unavailable || report.summary.renderedIntegrityPass !== report.summary.requirements || report.cleanup.unloaded === false ? 1 : 0;
}
