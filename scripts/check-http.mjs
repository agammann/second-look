import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import assert from 'node:assert/strict';
import { startLocalServer } from '../server.mjs';

const report = { startedAt:new Date().toISOString(),kind:'Actual loopback HTTP smoke; no mocked transport, no PayPal or model call',pass:false,checks:[] };
const dataDir = await mkdtemp(join(tmpdir(),'second-look-http-'));
let running;
try {
  process.env.PAYPAL_SANDBOX_ENABLED = 'false';
  running = await startLocalServer({port:4321,dataDir});
  const failedDataDir = join(dataDir, 'failed-listen');
  await assert.rejects(startLocalServer({port:4321,dataDir:failedDataDir}), {code:'EADDRINUSE'});
  assert.ok(resolve(failedDataDir).startsWith(resolve(dataDir) + sep));
  await rm(failedDataDir,{recursive:true,force:false});
  report.checks.push('failed listener releases SQLite and permits owned cleanup');
  const config = await fetch('http://127.0.0.1:4321/api/config',{signal:AbortSignal.timeout(2000)});
  const data = await config.json();
  assert.equal(data.paypal.mode,'sandbox'); report.checks.push('config');
  const listingResponse = await fetch('http://127.0.0.1:4321/api/listings',{signal:AbortSignal.timeout(2000)});
  assert.equal((await listingResponse.json()).listings.length,6); report.checks.push('six listings');
  const page = await fetch('http://127.0.0.1:4321/',{signal:AbortSignal.timeout(2000)});
  assert.equal(page.status,200); assert.match(await page.text(),/<main/); report.checks.push('HTML loads');
  const reviewModule = await fetch('http://127.0.0.1:4321/quote-review.js',{signal:AbortSignal.timeout(2000)});
  assert.equal(reviewModule.status,200);
  assert.match(reviewModule.headers.get('content-type'),/javascript/);
  assert.match(await reviewModule.text(),/export /);
  report.checks.push('shared quote review module loads as JavaScript');
  report.pass = true;
} catch(error) { report.error={message:error.message,code:error.cause?.code || error.code || error.name}; process.exitCode=1; }
finally {
  await running?.close();
  // Only this fresh directory created above is removed.
  if (resolve(dataDir).startsWith(resolve(tmpdir()) + sep)) await rm(dataDir,{recursive:true,force:true});
  report.finishedAt=new Date().toISOString();
  await mkdir(resolve('artifacts'),{recursive:true});
  await writeFile(resolve('artifacts/http-live.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
