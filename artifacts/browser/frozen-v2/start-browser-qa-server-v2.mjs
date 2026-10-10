/** Isolated, temporary local server for authorized browser QA. No .env is read. */
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { resolve, dirname, relative, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalServer } from '../server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = resolve(root, 'artifacts/browser/temporary-data');
await mkdir(temporaryRoot, { recursive: true });
if ((await realpath(temporaryRoot)).toLowerCase() !== temporaryRoot.toLowerCase()) throw new Error('QA temporary root must be a real directory inside the project.');
const dataDir = await mkdtemp(resolve(temporaryRoot, 'owned-v2-'));
const ownedDataPath = await realpath(dataDir);
const record = { startedAt: new Date().toISOString(), origin: 'http://127.0.0.1:4322', dataDir, paypalConfigured: false, stopped: false, temporaryDataRemoved: false };
let running;
let stopping = false;
process.env.PAYPAL_SANDBOX_ENABLED = 'false';

async function stop() {
  if (stopping) return;
  stopping = true;
  try {
    if (running) { await running.close(); record.stopped = true; }
    const actual = await realpath(dataDir);
    const nested = relative(temporaryRoot, actual);
    if (actual.toLowerCase() !== ownedDataPath.toLowerCase() || !nested || nested.startsWith('..') || isAbsolute(nested) || !basename(actual).startsWith('owned-v2-')) throw new Error('Refusing to remove an unverified QA data directory.');
    await rm(actual, { recursive: true, force: false });
    record.temporaryDataRemoved = true;
  } catch (error) { record.error = error.message; process.exitCode = 1; }
  record.finishedAt = new Date().toISOString();
  await writeFile(resolve(root, 'artifacts/browser/v2-server-cleanup.json'), JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record, null, 2));
  process.stdin.pause();
}

try {
  running = await startLocalServer({ port: 4322, dataDir });
  const response = await fetch(`${record.origin}/api/config`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The isolated QA server configuration check failed.');
  const config = await response.json();
  record.paypalConfigured = config.paypal?.configured;
  if (record.paypalConfigured !== false) throw new Error('The isolated QA server must keep PayPal disabled.');
  console.log('Owned v2 QA server ready. Send stop on stdin to close only this server and remove only its verified temporary data.');
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async value => { if (value.trim() === 'stop') await stop(); });
  process.stdin.once('end', stop);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
} catch (error) {
  record.startError = error.message;
  process.exitCode = 1;
  await stop();
}
