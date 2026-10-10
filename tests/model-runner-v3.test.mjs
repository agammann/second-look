// Control-flow and integrity mocks only. No service, weights or real inference.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mapRetrievalDataset, assessRenderedIntegrity, pendingRetrievalAudit } from '../scripts/quote-retrieval-integrity.mjs';
import { validateModelOutput, eligibleSource, sourceDigest, QUESTION_TEMPLATES, EVIDENCE_LIMITS, EVIDENCE_VERSION } from '../artifacts/model-check/v3/evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function mockRun(t, mode, { ownership = true, existingOutput = false } = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'second-look-v3-runner-mock-'));
  const preload = join(folder, 'mock-fetch.mjs');
  const dataset = join(folder, 'mock-dataset.json');
  const output = join(folder, 'mock-result.json');
  const events = join(folder, 'events.jsonl');
  t.after(async () => {
    for (const path of [preload, dataset, output, events]) await unlink(path).catch(() => {});
    await rmdir(folder);
  });
  await writeFile(dataset, JSON.stringify({ dataset: 'unit-v3-runner-mock-not-accuracy', cases: [
    { id: 'mock-source', description: 'The red toy works. The blue toy is untested.', requirements: ['A working blue toy'],
      essentialQuotes: ['The blue toy is untested.'], acceptableQuestion: 'GOLD-ONLY-QUESTION-SENTINEL', pitfall: 'GOLD-ONLY-PITFALL-SENTINEL' },
  ] }));
  if (existingOutput) await writeFile(output, 'first report preserved');
  await writeFile(preload, `
    import { appendFile } from 'node:fs/promises';
    const mode = process.env.SECOND_LOOK_V3_RUNNER_MOCK;
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url).pathname;
      await appendFile(process.env.SECOND_LOOK_V3_RUNNER_EVENTS, JSON.stringify({path,body:init.body ?? null})+'\\n');
      if (path === '/api/ps') return Response.json({models:mode === 'resident' ? [{name:'qwen3.5:4b-q4_K_M',digest:'MOCK'}] : []});
      if (path === '/api/tags') return Response.json({models:[{name:'qwen3.5:4b-q4_K_M',digest:'MOCK',size:0}]});
      if (path === '/api/show') return Response.json({details:{quantization_level:'Q4_K_M',format:'mock',family:'mock'}});
      if (path === '/api/chat') {
        if (mode === 'fail') throw Object.assign(new Error('mock failed after possible load'),{cause:{code:'ETIMEDOUT'}});
        const selected = mode === 'invalid-id' ? 's31' : 's1';
        return Response.json({model:'qwen3.5:4b-q4_K_M',done:mode !== 'incomplete',done_reason:'stop',
          message:{role:'assistant',content:JSON.stringify({results:[{index:0,spanIds:[selected],questionIds:['q_scope']}]})}});
      }
      if (path === '/api/generate') return Response.json({done:true});
      throw new Error('Unexpected mock route');
    };
  `);
  const cli = ['--import', pathToFileURL(preload).href, join(root, 'scripts/check-model.mjs'), '--evidence-version', 'v3', '--evaluation', 'runner-mock', '--dataset', dataset, '--output', output];
  if (ownership) cli.push('--owns-model-use');
  const execution = spawnSync(process.execPath, cli, { cwd: root, env: { ...process.env, SECOND_LOOK_V3_RUNNER_MOCK: mode, SECOND_LOOK_V3_RUNNER_EVENTS: events }, encoding: 'utf8', timeout: 10000 });
  if (execution.error) throw execution.error;
  const eventRows = await readFile(events, 'utf8').then((text) => text.trim().split('\n').filter(Boolean).map(JSON.parse)).catch(() => []);
  const outputText = await readFile(output, 'utf8');
  return { execution, events: eventRows, report: existingOutput ? null : JSON.parse(outputText), outputText };
}

test('v3 runner mock: gold is report-only and wrong-variant exactness is not semantic success', async (t) => {
  const { execution, report, events } = await mockRun(t, 'respond');
  assert.equal(execution.status, 0, execution.stderr);
  assert.equal(report.selectedVersion, 'v3');
  assert.equal(report.summary.validMechanicalRequirements, 1);
  assert.equal(report.summary.rawAcceptedResponses, 1);
  assert.equal(report.cases[0].analysis.results[0].suggestions[0].quote, 'The red toy works.');
  assert.equal(report.cases[0].retrievalAudit.state, 'pending-human-review');
  assert.match(report.summary.semanticAdequacy, /pending human/u);
  const request = JSON.parse(events.find((event) => event.path === '/api/chat').body);
  const user = JSON.parse(request.messages[1].content);
  assert.deepEqual(Object.keys(user).sort(), ['buyer_requirements', 'eligible_source_spans', 'neutral_questions']);
  assert.deepEqual(user.buyer_requirements, [{ index: 0, requirement: 'A working blue toy' }]);
  assert.doesNotMatch(JSON.stringify(request), /GOLD-ONLY|essentialQuotes|pitfall/u);
  assert.equal(report.cleanup.unloaded, true);
});

test('v3 runner mock: failed isolated request unloads even without a successful response', async (t) => {
  const { report } = await mockRun(t, 'fail');
  assert.equal(report.inferenceRequests, 1);
  assert.equal(report.successfulResponses, 0);
  assert.equal(report.summary.rawResponses, 0);
  assert.equal(report.summary.attemptedWithoutModelResponse, 1);
  assert.equal(report.summary.validationCounts.unavailable, 1);
  assert.equal(report.cleanup.attempted, true);
  assert.equal(report.cleanup.unloaded, true);
});

test('v3 runner mock: rejected raw IDs stay failures while rendered empty failure remains honest', async (t) => {
  const { execution, report } = await mockRun(t, 'invalid-id');
  assert.equal(execution.status, 1);
  assert.equal(report.summary.rawResponses, 1);
  assert.equal(report.summary.rawAcceptedResponses, 0);
  assert.equal(report.summary.validMechanicalRequirements, 0);
  assert.equal(report.summary.renderedIntegrityPass, 1);
  assert.equal(report.cases[0].rawAssessment[0].rawRows[0].spanIds[0], 's31');
  assert.deepEqual(report.cases[0].analysis.results[0].suggestions, []);
  assert.deepEqual(report.cases[0].analysis.results[0].questions, []);
});

test('v3 runner mock: incomplete actual envelope is received but never accepted', async (t) => {
  const { report } = await mockRun(t, 'incomplete');
  assert.equal(report.successfulResponses, 1);
  assert.equal(report.cases[0].modelResponseReceived, true);
  assert.equal(report.cases[0].rawAssessment[0].envelopeAccepted, false);
  assert.equal(report.summary.validationCounts.invalid, 1);
  assert.equal(report.cleanup.unloaded, true);
});

test('v3 runner mock: existing resident model prevents inference and unload', async (t) => {
  const { report, events } = await mockRun(t, 'resident');
  assert.equal(report.status, 'blocked');
  assert.equal(report.inferenceRequests, 0);
  assert.equal(report.cleanup.attempted, false);
  assert.deepEqual(events.map((event) => event.path), ['/api/ps']);
});

test('v3 runner mock: absent ownership blocks inference despite empty residency', async (t) => {
  const { report, events } = await mockRun(t, 'respond', { ownership: false });
  assert.equal(report.status, 'blocked');
  assert.equal(report.inferenceRequests, 0);
  assert.equal(report.cleanup.attempted, false);
  assert.deepEqual(events.map((event) => event.path), ['/api/ps']);
});

test('v3 runner mock: first output cannot be overwritten or trigger a rerun', async (t) => {
  const { execution, events, outputText } = await mockRun(t, 'respond', { existingOutput: true });
  assert.notEqual(execution.status, 0);
  assert.equal(outputText, 'first report preserved');
  assert.deepEqual(events, []);
});

test('retrieval evaluation mapping preserves Unicode/whole statements; integrity rejects altered rendering only', () => {
  const requirement = '  Blue toy — “complete”, doesn’t need a box  ';
  const description = 'The red toy works.\nThe blue toy is untested.';
  const mapped = mapRetrievalDataset([{ requirements: [requirement], listing: description, essentialQuotes: ['The blue toy is untested.'], acceptableQuestion: null, pitfall: 'scope' }]);
  assert.equal(mapped.cases[0].requirements[0], requirement);
  assert.equal(mapped.cases[0].description, description);
  const results = validateModelOutput(JSON.stringify({ results: [{ index: 0, spanIds: ['s1'], questionIds: ['q_scope'] }] }), { description, requirements: [requirement] });
  const analysis = { kind: 'quote-suggestions', evidenceVersion: EVIDENCE_VERSION, sourceDigest: sourceDigest(description), sourceSpans: eligibleSource(description).spans, results };
  assert.equal(assessRenderedIntegrity(analysis, { description, requirements: [requirement] }, QUESTION_TEMPLATES, EVIDENCE_LIMITS, EVIDENCE_VERSION)[0].renderedIntegrityPass, true);
  assert.equal(pendingRetrievalAudit(mapped.cases[0].criteria).state, 'pending-human-review');
  results[0].suggestions[0].quote = 'The blue toy works.';
  assert.equal(assessRenderedIntegrity(analysis, { description, requirements: [requirement] }, QUESTION_TEMPLATES, EVIDENCE_LIMITS, EVIDENCE_VERSION)[0].checks.sourceRendering, false);
});
