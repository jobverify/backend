import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';import {fileURLToPath} from 'node:url';
import {writeFileAtomically} from '../rewriting/atomicFile.js';
import {rewritePolicyIdentity} from '../rewriting/policyIdentity.js';
import {REWRITE_MODEL} from '../src/services/jobDescriptionPolicy.js';import {evaluateLocalJobs,archiveJobSnapshot} from '../rewriting/localEvaluation.js';import {createRewriteClient} from '../rewriting/runner.js';import {prepareRewriteRuntime,startRewriteWorker,workerMemoryBytes} from '../rewriting/worker.js';
const option=name=>{const i=process.argv.indexOf(name);return i<0?null:process.argv[i+1];};
const runDir=option('--run-dir'),catalogFile=option('--catalog'),output=option('--output');
if(!runDir||!catalogFile||!output)throw new Error('Use --run-dir <dry scrape> --catalog <scope.json> --output <evaluation dir>; no MongoDB connection is made.');
const outputDir=path.resolve(output),watch=process.argv.includes('--watch'),budget=Number(option('--budget-seconds')||18000);if(!Number.isFinite(budget)||budget<1)throw new Error('Invalid evaluation budget');
const deadline=Date.now()+budget*1000,controller=new AbortController();for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>controller.abort());
const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(Math.min(2147483647,Math.ceil(budget*1000)))]);
const base=fileURLToPath(new URL('../',import.meta.url));
const policyIdentity=await rewritePolicyIdentity();
const catalog=JSON.parse(await fs.readFile(catalogFile,'utf8')).catalog;await fs.mkdir(outputDir,{recursive:true});await fs.mkdir(path.join(outputDir,'snapshots'),{recursive:true});
const catalogIdentity=createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
const initialState=JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8'));
const runIdentity=createHash('sha256').update(JSON.stringify([path.resolve(runDir),initialState.runId,initialState.createdAt])).digest('hex');
const summaryFile=path.join(outputDir,'summary.json');let report={policyIdentity,catalogIdentity,runIdentity,model:REWRITE_MODEL,startedAt:new Date().toISOString(),environment:{cpu:os.cpus()[0]?.model,threads:REWRITE_MODEL.cpuThreads,platform:process.platform},companies:{}};
try{const old=JSON.parse(await fs.readFile(summaryFile,'utf8'));if(old.policyIdentity===policyIdentity && old.catalogIdentity===catalogIdentity && old.runIdentity===runIdentity)report={...old,resumedAt:new Date().toISOString()};}catch(error){if(error.code!=='ENOENT')throw error;}
delete report.status;delete report.error;delete report.errorType;delete report.interrupted;
const stopTimer=setInterval(async()=>{try{await fs.access(path.join(outputDir,'stop-request.json'));controller.abort();}catch(error){if(error.code!=='ENOENT')controller.abort();}},2000);stopTimer.unref();
let worker,client;const save=async()=>{report.updatedAt=new Date().toISOString();const rows=Object.values(report.companies);report.summary={companiesEvaluated:rows.filter(r=>r.finished).length,companiesStarted:rows.length,totalCompanies:catalog.length,jobsReviewed:rows.reduce((n,r)=>n+(r.rows?.length||0),0),jobsDiscovered:rows.reduce((n,r)=>n+(r.jobs||0),0),accepted:rows.reduce((n,r)=>n+(r.accepted||0),0),generated:rows.reduce((n,r)=>n+(r.generated||0),0),failed:rows.reduce((n,r)=>n+(r.failed||0),0),skipped:rows.reduce((n,r)=>n+(r.skipped||0),0),emptySources:rows.filter(r=>r.jobs===0&&r.scrapeSuccess).length,sourceFailures:rows.filter(r=>!r.scrapeSuccess).length};await writeFileAtomically(summaryFile,JSON.stringify(report,null,2)+'\n');};
const lazyClient={generate:async(input,options)=>{if(!worker){worker=await startRewriteWorker({...await prepareRewriteRuntime({signal}),signal,deadline,port:18768,logFile:path.join(outputDir,'worker.log')});client=createRewriteClient({...worker,planCacheDir:path.join(outputDir,'plans')});}return client.generate(input,options);}};
try{
 while(!signal.aborted&&Date.now()<deadline){
  let state;try{state=JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(state&&state.mode!=='dry-run')throw new Error('Only a dry-run scraper checkpoint may be evaluated locally');
  let changed=false;
  for(const item of catalog){
   const source=item.source,completed=state?.completed?.[source];if(!completed||(report.companies[source]?.completedAt===completed.completedAt && report.companies[source]?.finished))continue;
   if(signal.aborted||Date.now()>=deadline)break;
   if(!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source))throw new Error('Invalid catalog source');
   if(!completed.result.success){report.companies[source]={completedAt:completed.completedAt,scrapeSuccess:false,finished:true,jobs:0,reason:completed.result.error||'scraper_failed'};changed=true;continue;}
   const snapshot=path.join(outputDir,'snapshots',source+'-'+createHash('sha256').update(runIdentity+completed.completedAt).digest('hex').slice(0,12)+'.json');
   const jobs=await archiveJobSnapshot(item.file,snapshot,{sourceRoot:base});
   const previous=report.companies[source]?.completedAt===completed.completedAt ? report.companies[source] : null;
   const rows=[...(previous?.rows||[])],offset=rows.length;
   const stats=await evaluateLocalJobs(jobs.slice(offset,offset+1),{outputDir:path.join(outputDir,'cases'),policyIdentity,client:lazyClient,deadline,signal,onResult:row=>{rows.push({inputHash:row.inputHash,accepted:row.accepted,generated:row.generated,reason:row.reason,durationMs:row.durationMs,file:row.file});console.log(JSON.stringify({source,title:row.title,cached:row.cached||false,accepted:row.accepted,reason:row.reason,durationMs:row.durationMs}));}});
   if(stats.interrupted){report.interrupted=true;await save();break;}
   report.companies[source]={completedAt:completed.completedAt,scrapeSuccess:true,finished:rows.length===jobs.length,jobs:jobs.length,accepted:rows.filter(r=>r.accepted).length,generated:rows.filter(r=>r.generated).length,failed:rows.filter(r=>r.generated&&!r.accepted).length,skipped:rows.filter(r=>!r.generated).length,rows};changed=true;await save();
  }
  await save();
  if(state?.status==='complete'&&catalog.every(item=>state.completed?.[item.source] && report.companies[item.source]?.finished && report.companies[item.source].completedAt===state.completed[item.source].completedAt)){report.status='complete';break;}
  if(!watch && state?.status!=='complete'){report.status='waiting_for_scrapers';break;}
  if(!changed && state?.status==='complete'){report.status='incomplete_checkpoint';process.exitCode=1;break;}
  if(!changed)await delay(15000,undefined,{signal});
 }
 if(!report.status)report.status=controller.signal.aborted?'interrupted':'budget_exhausted';
}catch(error){report.status=signal.aborted?'budget_exhausted':'error';report.errorType=error.name;report.error=error.message;if(!signal.aborted)process.exitCode=1;}
finally{clearInterval(stopTimer);report.maxWorkerMemoryBytes=worker?await workerMemoryBytes(worker.pid).catch(()=>null):report.maxWorkerMemoryBytes;await worker?.stop();await save();console.log(JSON.stringify({status:report.status,...report.summary}));if(report.status==='budget_exhausted')process.exitCode=75;}
