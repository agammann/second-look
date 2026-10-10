// Read-only fixed loopback model metadata. Does not load or start a model/service.
import { writeFile, readFile } from 'node:fs/promises';
import { MODEL } from '../lib/evidence.mjs';
const base = 'http://127.0.0.1:11434';
async function local(path, options = {}) {
  const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(10000), ...options });
  if (!response.ok) throw new Error('Approved loopback metadata request failed.');
  return response.json();
}
const tags = await local('/api/tags');
const installed = tags.models.find((entry) => (entry.name ?? entry.model) === MODEL);
if (!installed) throw new Error('Fixed retained model is not installed.');
const details = await local('/api/show', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, verbose: false }) });
const frozen = JSON.parse(await readFile('artifacts/model-check/v1/identity.json', 'utf8'));
const metadata = {
  capturedAt: new Date().toISOString(), fixedModel: MODEL,
  installedManifestDigest: installed.digest, installedBytes: installed.size,
  quantization: details.details?.quantization_level ?? installed.details?.quantization_level ?? null,
  format: details.details?.format, family: details.details?.family, parameterSize: details.details?.parameter_size,
  source: 'Existing approved loopback Ollama /api/tags and /api/show; read-only metadata, no load/startup.',
  frozenV1: frozen,
};
await writeFile('artifacts/model-check/independent-holdout-v1-identity.json', JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify(metadata, null, 2));
