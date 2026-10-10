// Runner control-flow mocks only. No real Ollama service or model request occurs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function mockRun(t, mode) {
  const folder = await mkdtemp(join(tmpdir(), 'second-look-runner-mock-'));
  const preload = join(folder, 'mock-fetch.mjs');
  const dataset = join(folder, 'mock-dataset.json');
  const output = join(folder, 'mock-result.json');
  t.after(async () => {
    // Only these three files created by this test are removed; no recursive delete.
    for (const path of [preload, dataset, output]) await unlink(path).catch(() => {});
    await rmdir(folder);
  });
  await writeFile(dataset, JSON.stringify({ dataset: 'unit-runner-mock-not-accuracy', purpose: 'fresh-holdout', frozenAt: '2026-10-09T00:00:00Z', cases: [{ id: 'mock-unknown', description: 'The figure is green.', requirements: ['Original box included'], expected: [{ status: 'unknown', acceptableQuotes: [], note: 'Unit test mock only.' }] }] }));
  await writeFile(preload, `
    const mode = process.env.SECOND_LOOK_RUNNER_TEST_MODE;
    globalThis.fetch = async (url) => {
      const path = new URL(url).pathname;
      if (path === '/api/ps') return Response.json({models: mode === 'resident' ? [{name:'qwen3.5:4b-q4_K_M',digest:'unit-mock'}] : []});
      if (path === '/api/tags') return Response.json({models:[{name:'qwen3.5:4b-q4_K_M',digest:'unit-mock',size:0}]});
      if (path === '/api/show') return Response.json({details:{quantization_level:'Q4_K_M',format:'mock',family:'mock'}});
      if (path === '/api/chat') {
        if (mode === 'fail') throw Object.assign(new Error('mock request failure after potential model load'), {cause:{code:'ETIMEDOUT'}});
        return Response.json({model:'qwen3.5:4b-q4_K_M',done:true,done_reason:'stop',message:{role:'assistant',content:JSON.stringify({results:[{index:0,status:'unknown',quotes:[]}]})}});
      }
      if (path === '/api/generate') return Response.json({done:true});
      throw new Error('Unexpected mocked route');
    };
  `);
  const execution = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, join(root, 'scripts/check-model.mjs'), '--evidence-version', 'v1', '--evaluation', 'runner-mock', '--owns-model-use', '--dataset', dataset, '--output', output], { cwd: root, env: { ...process.env, SECOND_LOOK_RUNNER_TEST_MODE: mode }, encoding: 'utf8', timeout: 10000 });
  if (execution.error) throw execution.error;
  assert.match(execution.stdout, /Saved /u, execution.stderr);
  return { execution, report: JSON.parse(await readFile(output, 'utf8')) };
}

test('runner mock: failed isolated request still unloads a potentially loaded owned model', async (t) => {
  const { report } = await mockRun(t, 'fail');
  assert.equal(report.inferenceRequests, 1);
  assert.equal(report.successfulResponses, 0);
  assert.equal(report.cleanup.attempted, true);
  assert.equal(report.cleanup.unloaded, true);
  assert.equal(report.summary.modelOnly.requirements, 0);
  assert.equal(report.summary.attemptedWithoutModelResponse, 1);
  assert.equal(report.summary.unavailableRequirements, 1);
  assert.equal(report.cases[0].modelResponseReceived, false);
});

test('runner mock: only actual responses count toward model-only scoring', async (t) => {
  const { execution, report } = await mockRun(t, 'respond');
  assert.equal(execution.status, 0);
  assert.equal(report.summary.modelOnly.requirements, 1);
  assert.equal(report.summary.modelOnly.contractPass, 1);
  assert.equal(report.cases[0].modelResponseReceived, true);
  assert.equal(report.cleanup.attempted, true);
  assert.equal(report.cleanup.unloaded, true);
});

test('runner mock: existing residency is preserved without inference or unload', async (t) => {
  const { report } = await mockRun(t, 'resident');
  assert.equal(report.status, 'blocked');
  assert.equal(report.inferenceRequests, 0);
  assert.equal(report.cleanup.attempted, false);
});
