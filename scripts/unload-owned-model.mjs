import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MODEL } from '../lib/evidence.mjs';
if (!process.argv.includes('--owns-model-use')) throw new Error('Use this only after confirming ownership of the fixed Qwen model use.');
const report = { startedAt:new Date().toISOString(),model:MODEL,ownershipAcknowledged:true,unloaded:false };
try {
  const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(10000),body:JSON.stringify({model:MODEL,stream:false,keep_alive:0})});
  if(!response.ok)throw new Error('Owned model unload request failed.');
  await response.json();
  const status=await fetch('http://127.0.0.1:11434/api/ps',{redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!status.ok)throw new Error('Could not verify model residency.');
  const data=await status.json();
  report.residentAfter=(data.models||[]).map(value=>value.name||value.model);
  report.unloaded=Array.isArray(data.models)&&!report.residentAfter.includes(MODEL);
  if(!report.unloaded)process.exitCode=1;
}catch(error){report.error=error.cause?.code||error.message;process.exitCode=1;}
report.finishedAt=new Date().toISOString();
await mkdir(resolve('artifacts/model-check'),{recursive:true});
await writeFile(resolve('artifacts/model-check/after-browser-cleanup.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
