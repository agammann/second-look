/** Explicit local inference runner. Never starts Ollama or changes service/network settings. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = 'http://127.0.0.1:11434';
const args = process.argv.slice(2);
const value = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
const selectedVersion = value('--evidence-version', 'v2');
if (!['v1', 'v2'].includes(selectedVersion)) throw new Error('Evidence version must be v1 or v2.');
const modulePath = resolve(root, `artifacts/model-check/${selectedVersion}/evidence.mjs`);
const { analyzeListing, validateEvidenceInput, MODEL, EVIDENCE_VERSION, EVIDENCE_LIMITS, SYSTEM_PROMPT, EVIDENCE_SCHEMA } = await import(pathToFileURL(modulePath).href);
const evaluationPurpose = value('--evaluation', 'exposed-regression');
if (!['exposed-regression', 'fresh-independent', 'internal-synthetic', 'runner-mock'].includes(evaluationPurpose)) throw new Error('Unsupported evaluation purpose.');
const datasetPath = resolve(root, value('--dataset', 'tests/fixtures/fresh-holdout-v1.json'));
const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
const outputPath = resolve(root, value('--output', `artifacts/model-check/${stamp}.json`));
const ownsModelUse = args.includes('--owns-model-use');
const sha = (input) => createHash('sha256').update(input).digest('hex');
const report = {
  kind: 'live-local-model-check', model: MODEL, evidenceVersion: EVIDENCE_VERSION, selectedVersion, evaluationPurpose,
  quotePolicy: selectedVersion === 'v1' ? 'Unknown requires empty quotes; known requires one complete source sentence/line.' : 'Unknown may preserve exact eligible relevant context, which is not support for a known decision. Known allows bounded contiguous complete source spans.',
  startedAt: new Date().toISOString(), status: 'not_started', datasetPath,
  context: EVIDENCE_LIMITS.context, maxOutputTokens: EVIDENCE_LIMITS.outputTokens,
  ownershipRequested: ownsModelUse, preflight: null, cleanup: null, cases: [],
  limitations: [
    'Small English synthetic evaluation. Seller statement support does not prove truth, provenance or authenticity.',
    'Conservative deterministic English guards can reject legitimate wording and do not prove semantic support.',
    'Only cases that received an actual successful model-service response count toward model-only results; attempts without a response and prefiltered instructions are reported separately.',
    'The authored fresh-holdout-v1 is an internal synthetic holdout, not the parent independent unseen holdout.',
    'Using failures to tune the module makes later reruns regression checks rather than fresh accuracy evidence.',
  ],
};
let isolatedUse = false;
let inferenceRequests = 0;
let successfulResponses = 0;
let currentRaw = [];

function errorSummary(error) {
  return { name: error?.name ?? 'Error', code: error?.cause?.code ?? error?.code ?? null, message: error?.cause?.code === 'EACCES' ? 'Loopback connection was denied by the execution environment.' : 'The approved loopback model service could not be reached or used.' };
}

async function boundedText(response) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > EVIDENCE_LIMITS.responseBytes) throw new Error('oversized response');
    return text;
  }
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > EVIDENCE_LIMITS.responseBytes) throw new Error('oversized response');
      chunks.push(value);
    }
  } finally {
    if (size > EVIDENCE_LIMITS.responseBytes) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function localJSON(path, init = {}) {
  const response = await fetch(`${base}${path}`, { redirect: 'error', signal: AbortSignal.timeout(10000), ...init });
  if (!response.ok) throw new Error('local service error');
  return JSON.parse(await boundedText(response));
}

const tracedFetch = async (url, init) => {
  inferenceRequests++;
  try {
    const response = await fetch(url, init);
    if (response.ok) successfulResponses++;
    let body;
    try { body = await boundedText(response.clone()); } catch { body = null; }
    currentRaw.push({ status: response.status, rawBody: body, rawBodyBounded: body !== null });
    return response;
  } catch (error) {
    currentRaw.push({ transportError: errorSummary(error) });
    throw error;
  }
};

function assess(result, expected) {
  const labelCorrect = result.status === expected.status;
  const validationAccepted = ['valid', 'untrusted'].includes(result.validation);
  const exactExpectedQuotes = expected.status === 'unknown' ? (result.quotes.length === 0 || (selectedVersion === 'v2' && result.validation === 'valid' && result.status === 'unknown')) : result.quotes.length > 0 && result.quotes.every((quote) => expected.acceptableQuotes.includes(quote));
  const failures = [];
  if (!labelCorrect) failures.push(`Expected ${expected.status}; got ${result.status}.`);
  if (!validationAccepted) failures.push(`Validation was ${result.validation}.`);
  if (!exactExpectedQuotes) failures.push('Accepted quotes did not match predeclared adequate full-sentence evidence; manual semantic audit needed.');
  return { labelCorrect, validationAccepted, exactExpectedQuotes, contractPass: labelCorrect && validationAccepted && exactExpectedQuotes, failures };
}

function rawAssessment(entry, rawResponses) {
  const assessments = [];
  for (const response of rawResponses) {
    if (response.status !== 200 || typeof response.rawBody !== 'string') continue;
    try {
      const envelope = JSON.parse(response.rawBody);
      const payload = JSON.parse(envelope.message.content);
      const rows = payload.results;
      const orderedCount = Array.isArray(rows) && rows.length === entry.expected.length && rows.every((row, index) => row.index === index && ['match', 'contradiction', 'unknown'].includes(row.status) && Array.isArray(row.quotes));
      assessments.push({ orderedCount, rawRows: Array.isArray(rows) ? rows : null, labelComparisons: orderedCount ? rows.map((row, index) => ({ index, expected: entry.expected[index].status, status: row.status, labelCorrect: row.status === entry.expected[index].status, quotes: row.quotes })) : [], error: null });
    } catch { assessments.push({ orderedCount: false, rawRows: null, labelComparisons: [], error: 'Malformed raw content or envelope.' }); }
  }
  return assessments;
}

try {
  const datasetText = await readFile(datasetPath, 'utf8');
  const dataset = JSON.parse(datasetText);
  if (!Array.isArray(dataset.cases) || !dataset.cases.length || dataset.cases.length > 100 || !dataset.dataset || dataset.purpose !== 'fresh-holdout') throw new Error('bad dataset');
  for (const entry of dataset.cases) {
    validateEvidenceInput(entry);
    if (!entry.id || !Array.isArray(entry.expected) || entry.expected.length !== entry.requirements.length) throw new Error('bad expectations');
    for (const expected of entry.expected) {
      if (!['match', 'contradiction', 'unknown'].includes(expected.status) || !Array.isArray(expected.acceptableQuotes) || expected.acceptableQuotes.some((quote) => typeof quote !== 'string' || !entry.description.includes(quote))) throw new Error('bad gold quotes');
    }
  }
  report.dataset = { name: dataset.dataset, purpose: dataset.purpose, frozenAt: dataset.frozenAt, sha256: sha(datasetText), caseCount: dataset.cases.length, requirementCount: dataset.cases.reduce((sum, entry) => sum + entry.requirements.length, 0), internalHoldout: dataset.dataset === 'fresh-holdout-v1' };
  if (evaluationPurpose === 'fresh-independent' && ['fresh-holdout-v1', 'parent-independent-holdout-v1'].includes(dataset.dataset)) throw new Error('Known exposed datasets cannot be scored as fresh independent.');
  const moduleText = await readFile(modulePath);
  report.moduleSha256 = sha(moduleText);
  report.promptSha256 = sha(SYSTEM_PROMPT);
  report.schemaSha256 = sha(JSON.stringify(EVIDENCE_SCHEMA));
  const freeze = JSON.parse(await readFile(resolve(root, `artifacts/model-check/freeze-${selectedVersion}.json`), 'utf8'));
  report.freeze = freeze;
  if (freeze.moduleSha256 !== report.moduleSha256 || freeze.promptSha256 !== report.promptSha256) throw new Error('module changed since freeze');

  let resident;
  try {
    resident = await localJSON('/api/ps');
    report.preflight = { reachable: true, existingModels: resident.models?.map((model) => ({ name: model.name ?? model.model, digest: model.digest })) ?? [] };
  } catch (error) {
    report.status = 'blocked';
    report.preflight = { reachable: false, error: errorSummary(error) };
    report.blocker = 'Live inference was not run: this execution environment could not reach the existing approved loopback Ollama service. No startup, escalation, tunnel, firewall, binding, or sandbox changes were attempted.';
    report.cases = dataset.cases.map((entry) => ({ id: entry.id, status: 'not_run', requirements: entry.requirements, expected: entry.expected, reason: 'Loopback preflight failed; no model request.' }));
  }
  if (resident) {
    if (!Array.isArray(resident.models) || resident.models.length) {
      report.status = 'blocked';
      report.blocker = 'Refused live inference because a model is already resident, or residency could not be verified. Existing user model state was preserved.';
    } else if (!ownsModelUse) {
      report.status = 'blocked';
      report.blocker = 'No inference run: use --owns-model-use only after the parent authorizes isolated use of the existing approved loopback service. The runner never starts the service.';
    } else {
      isolatedUse = true;
      const tags = await localJSON('/api/tags');
      const installed = tags.models?.find((model) => (model.name ?? model.model) === MODEL);
      if (!installed?.digest) throw new Error('Fixed model installation identity could not be verified.');
      const details = await localJSON('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, verbose: false }) });
      report.modelIdentity = { capturedAt: new Date().toISOString(), manifestDigest: installed.digest, bytes: installed.size ?? null, quantization: details.details?.quantization_level ?? installed.details?.quantization_level ?? null, format: details.details?.format ?? null, family: details.details?.family ?? null, parameterSize: details.details?.parameter_size ?? null, source: 'Read-only existing loopback /api/tags and /api/show, before inference.' };
      if (report.modelIdentity.quantization !== 'Q4_K_M') throw new Error('The fixed model quantization did not match the authorized retained model.');
      report.status = 'running';
      for (const entry of dataset.cases) {
        currentRaw = [];
        const requestsBefore = inferenceRequests;
        const responsesBefore = successfulResponses;
        const analysis = await analyzeListing(entry, { fetchImpl: tracedFetch });
        const evaluated = analysis.results.map((result, index) => ({ requirement: entry.requirements[index], expected: entry.expected[index], result, ...assess(result, entry.expected[index]) }));
        const row = { id: entry.id, description: entry.description, requirements: entry.requirements, tags: entry.tags ?? [], inferenceRequested: inferenceRequests > requestsBefore, modelResponseReceived: successfulResponses > responsesBefore, raw: currentRaw, rawAssessment: rawAssessment(entry, currentRaw), analysis, evaluated, contractPass: evaluated.every((item) => item.contractPass) };
        report.cases.push(row);
        console.log(`${entry.id}: ${row.contractPass ? 'PASS' : 'FAIL'}; ${analysis.results.map((item) => `${item.status}/${item.validation}`).join(', ')}; ${analysis.durationMs} ms; ${row.inferenceRequested ? 'model request' : 'prefilter only'}`);
        for (const [index, item] of evaluated.entries()) if (!item.contractPass) console.log(`  requirement ${index + 1}: ${item.failures.join(' ')}`);
      }
      const all = report.cases.flatMap((entry) => entry.evaluated);
      const modelOnly = report.cases.filter((entry) => entry.modelResponseReceived).flatMap((entry) => entry.evaluated);
      const raw = report.cases.flatMap((entry) => entry.rawAssessment);
      const rawLabels = raw.flatMap((entry) => entry.labelComparisons);
      report.summary = {
        cases: report.cases.length, caseContractPass: report.cases.filter((entry) => entry.contractPass).length,
        requirements: all.length, correctLabels: all.filter((entry) => entry.labelCorrect).length, contractPass: all.filter((entry) => entry.contractPass).length,
        falseMatches: all.filter((entry) => entry.result.status === 'match' && entry.expected.status !== 'match').length,
        falseContradictions: all.filter((entry) => entry.result.status === 'contradiction' && entry.expected.status !== 'contradiction').length,
        prefilteredCases: report.cases.filter((entry) => !entry.inferenceRequested).length,
        attemptedWithoutModelResponse: report.cases.filter((entry) => entry.inferenceRequested && !entry.modelResponseReceived).length,
        unavailableRequirements: all.filter((entry) => entry.result.validation === 'unavailable').length,
        modelOnly: { requirements: modelOnly.length, correctLabels: modelOnly.filter((entry) => entry.labelCorrect).length, contractPass: modelOnly.filter((entry) => entry.contractPass).length },
        rawModel: { responses: raw.length, orderedResponses: raw.filter((entry) => entry.orderedCount).length, unscorableResponses: raw.filter((entry) => !entry.orderedCount).length, scoredRequirements: rawLabels.length, correctLabels: rawLabels.filter((entry) => entry.labelCorrect).length, falseMatches: rawLabels.filter((entry) => entry.status === 'match' && entry.expected !== 'match').length, falseContradictions: rawLabels.filter((entry) => entry.status === 'contradiction' && entry.expected !== 'contradiction').length, unknownRowsWithContext: rawLabels.filter((entry) => entry.status === 'unknown' && entry.quotes.length).length },
        failedCases: report.cases.filter((entry) => !entry.contractPass).map((entry) => entry.id),
      };
      report.status = 'completed';
    }
  }
} catch (error) {
  report.status = 'blocked';
  report.blocker = 'The dataset or frozen module could not be validated. No further inference requests were made.';
  report.error = { name: error.name, message: error.message };
} finally {
  // Explicit ownership plus empty preflight is required. Never unload another resident model.
  // A timed-out or failed request may still load weights, so attempted isolated use needs cleanup.
  if (isolatedUse && inferenceRequests > 0) {
    try {
      await localJSON('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, stream: false, keep_alive: 0 }) });
      const after = await localJSON('/api/ps');
      report.cleanup = { attempted: true, ownedModel: MODEL, residentAfter: after.models?.map((model) => model.name ?? model.model), unloaded: Array.isArray(after.models) && !after.models.some((model) => (model.name ?? model.model) === MODEL) };
    } catch (error) { report.cleanup = { attempted: true, unloaded: false, error: errorSummary(error) }; }
  } else report.cleanup = { attempted: false, reason: 'No isolated inference request; no model startup or unload was attempted.' };
  report.inferenceRequests = inferenceRequests;
  report.successfulResponses = successfulResponses;
  report.finishedAt = new Date().toISOString();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Saved ${outputPath}`);
  if (report.blocker) console.log(report.blocker);
  process.exitCode = report.status === 'completed' ? (report.summary?.failedCases.length ? 1 : 0) : 2;
}
