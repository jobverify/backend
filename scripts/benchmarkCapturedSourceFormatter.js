/** Full captured-workload benchmark of wording-preserving formatting, without a model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {formatEmployerSource} from '../rewriting/sourceOrderFormatter.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';

const option=process.argv.indexOf('--run-dir');
if(option<0||!process.argv[option+1])throw new Error('Use --run-dir <captured dry run>');
const recoverInlineHeadings=process.argv.includes('--recover-inline-headings');
const decodeEncodedMarkup=process.argv.includes('--decode-encoded-markup');
const labelIndex=process.argv.indexOf('--label'),label=labelIndex<0?'':process.argv[labelIndex+1];
if(label&&!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid formatter benchmark label');
const root=path.resolve(process.argv[option+1]),directory=path.join(root,'source-formatter-full'+(recoverInlineHeadings?'-inline':'')+(label?'-'+label:''));
await fs.mkdir(directory,{recursive:true});
const output=path.join(directory,'descriptions.ndjson');
try{await fs.access(output);throw new Error('Formatter results exist; preserve them before another benchmark.');}catch(e){if(e.code!=='ENOENT')throw e;}
const report={pid:process.pid,status:'running',startedAt:new Date().toISOString(),capturedRows:0,uniqueJobs:0,duplicates:0,formatted:0,missingSource:0,payloadChanged:0,withHeadings:0,withBullets:0,formatterComputeMs:0,peakHostMemoryPercent:0,peakProcessMiB:0,mongoWrites:0,method:'source_order_formatter_no_model',recoverInlineHeadings,decodeEncodedMarkup};
const seen=new Set(),started=performance.now();let stopped=false,guardBusy=false;
const guard=async()=>{
 if(guardBusy)return;guardBusy=true;
 try{
  const memoryPercent=100*(1-os.freemem()/os.totalmem());
  report.peakHostMemoryPercent=Math.max(report.peakHostMemoryPercent,memoryPercent);
  report.peakProcessMiB=Math.max(report.peakProcessMiB,process.memoryUsage().rss/1048576);
  if(memoryPercent>90){stopped=true;report.stopReason='resource_limit';await fs.writeFile(path.join(root,'user-stop'),JSON.stringify({source:'formatter',at:new Date().toISOString(),memoryPercent})+'\n');}
  for(const name of ['memory-stop.json','user-stop'])try{await fs.access(path.join(root,name));stopped=true;report.stopReason??='shared_stop';}catch(e){if(e.code!=='ENOENT')throw e;}
 }finally{guardBusy=false;}
};
await guard();const timer=setInterval(()=>{void guard().catch(e=>{stopped=true;report.error=e.message;});},2000);
try{
 for(const filename of (await fs.readdir(path.join(root,'snapshots'))).filter(f=>f.endsWith('.json')).sort()){
  if(stopped)break;
  const jobs=JSON.parse(await fs.readFile(path.join(root,'snapshots',filename),'utf8')),source=filename.slice(0,-5);let lines=[];
  for(const job of jobs){
   if(stopped)break;
   report.capturedRows++;
   const input=buildRewriteInput(job),url=job.sourceUrl||job.applyUrl||job.link;
   const key=createHash('sha256').update(source+'|'+(url||job.jobId||job.title)+'|'+input.inputHash).digest('hex');
   if(seen.has(key)){report.duplicates++;continue;}seen.add(key);report.uniqueJobs++;
   const before=performance.now(),draft=formatEmployerSource(input.sourceDescription,{recoverInlineHeadings,decodeEncodedMarkup});report.formatterComputeMs+=performance.now()-before;
   if(!draft.sourceAvailable)report.missingSource++;else if(!draft.preserved)report.payloadChanged++;else report.formatted++;
   if(draft.headingCount)report.withHeadings++;if(draft.bulletCount)report.withBullets++;
   lines.push(JSON.stringify({key,source,title:job.title,url,sourceWords:input.sourceWords,method:report.method,preserved:draft.preserved,sourceAvailable:draft.sourceAvailable,headings:draft.headingCount,bullets:draft.bulletCount,description:draft.sourceAvailable&&draft.preserved?draft.description:null}));
   if(lines.length>=100){await fs.appendFile(output,lines.join('\n')+'\n');lines=[];await delay(0);}
  }
  if(lines.length)await fs.appendFile(output,lines.join('\n')+'\n');
 }
 report.status=stopped?'stopped':'complete';
}catch(e){report.status='error';report.error=e.message;process.exitCode=1;}
finally{
 clearInterval(timer);await guard();if(stopped&&report.status==='complete')report.status='stopped';report.finishedAt=new Date().toISOString();report.wallSeconds=(performance.now()-started)/1000;
 report.limitation='Formatting checks normalized text/order after markup removal. It cannot recover absent content, infer unstated qualification scope, or prove employer source completeness. See run times and the guard report for concurrent workload.';
 await writeFileAtomically(path.join(directory,'summary.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 if(stopped)process.exitCode=90;
}
