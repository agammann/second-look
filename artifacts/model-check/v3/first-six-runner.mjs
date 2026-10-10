/** First parent six-case run. Requires exclusive owned model use; no service startup. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {analyzeListing,eligibleSource,MODEL,EVIDENCE_VERSION} from '../../../lib/evidence.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const base='http://127.0.0.1:11434';
const output='artifacts/model-check/independent-quote-v3-first.json';
const report={kind:'First live frozen quote-first parent six; no verdict scoring',startedAt:new Date().toISOString(),model:MODEL,evidenceVersion:EVIDENCE_VERSION,cases:[],preflight:null,cleanup:null,status:'not_started',semanticAssessment:'Pending independent human assessment, separate from source integrity',limitations:['Small English synthetic set; no truth/authenticity proof.','Frozen max3 suggestions cannot represent four separate essential sentence spans in chair case.','Fixed generic questions may be neutral but less useful than parent examples.']};
let ownsUse=false;
let attempted=0;
const localJSON=async(path,init={})=>{const r=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(10000),...init});if(!r.ok)throw Error('Loopback status '+r.status);return r.json();};
async function boundedText(response){const reader=response.body.getReader();let count=0;const chunks=[];try{for(;;){const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>32768){await reader.cancel();throw Error('Raw response exceeds bound');}chunks.push(value);}}finally{reader.releaseLock();}return Buffer.concat(chunks).toString('utf8');}
try{
  const freeze=JSON.parse(await readFile('artifacts/model-check/freeze-v3.json','utf8'));
  const moduleHash=sha(await readFile('lib/evidence.mjs'));
  if(moduleHash!==freeze.moduleSha256)throw Error('Frozen source changed');
  report.freeze=freeze;
  const bytes=await readFile('tests/fixtures/independent-quote-v3-raw.json');
  const cases=JSON.parse(bytes);
  if(cases.length!==6)throw Error('Expected exact six');
  report.datasetSha256=sha(bytes);
  report.preflight=await localJSON('/api/ps');
  if(report.preflight.models?.length!==0)throw Error('Residency not empty; exclusive use cannot be established');
  ownsUse=true;
  report.status='running';
  // Reserve the first output before inference; never overwrite a previous result.
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  for(const [index,entry] of cases.entries()){
    const input={description:entry.listing,requirements:[...entry.requirements]};
    const item={id:'fresh-six-'+(index+1),input,evaluationCriteria:entry,rawResponses:[],requests:[],source:eligibleSource(input.description)};
    const fetchImpl=async(url,init)=>{
      attempted++;
      const body=JSON.parse(init.body);
      item.requests.push({url,body});
      // analyzeListing constructs its request only from input above; criteria never enter it.
      const response=await fetch(url,init);
      const text=await boundedText(response);
      item.rawResponses.push({httpStatus:response.status,body:text});
      return new Response(text,{status:response.status,headers:response.headers});
    };
    item.delivered=await analyzeListing(input,{fetchImpl});
    item.mechanicalIntegrity={validRows:item.delivered.results.filter(row=>row.validation==='valid').length,totalRows:input.requirements.length,invalidRows:item.delivered.results.filter(row=>row.validation!=='valid').length};
    report.cases.push(item);
    await writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({id:item.id,durationMs:item.delivered.durationMs,validation:item.delivered.results.map(row=>row.validation),quotes:item.delivered.results.map(row=>row.suggestions),questions:item.delivered.results.map(row=>row.questions)}));
  }
  report.status='complete';
}catch(error){report.status='failed';report.error={name:error.name,message:error.message,code:error.cause?.code||error.code||null};process.exitCode=1;}
finally{
  if(ownsUse&&attempted){
    try{
      const unload=await localJSON('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,keep_alive:0,stream:false})});
      const residency=await localJSON('/api/ps');
      report.cleanup={unloadDone:unload.done===true,residency,empty:residency.models?.length===0};
      if(!report.cleanup.empty)process.exitCode=1;
    }catch(error){report.cleanup={empty:false,error:error.message};process.exitCode=1;}
  }else report.cleanup={modelUseAttempted:false};
  report.attemptedRequests=attempted;
  report.finishedAt=new Date().toISOString();
  // A reservation failure must not overwrite an already existing first result.
  if(ownsUse&&report.error?.code!=='EEXIST')await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,cases:report.cases.length,attempted,cleanup:report.cleanup,output}));
}
