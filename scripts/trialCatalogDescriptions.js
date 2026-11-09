import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';
import {buildScrapers} from '../scraper-support/providers/index.js';
import {parseArgs,runResilientScrape} from './resilientLocalScrape.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';
import {createResourceMonitor} from '../rewriting/resourceGuard.js';
import {prepareRewriteRuntime,startRewriteWorker,workerMemoryBytes} from '../rewriting/worker.js';
import {TRIAL_POLICY,createTrialClient} from '../rewriting/trialRephrase.js';
import {parseTrialOptions,assertTrialResume} from '../rewriting/trialControl.js';
import {runTrialCaptureQueue} from '../rewriting/trialCaptureQueue.js';
import {buildLocalScrapeRunEnv} from './localScrapeRunEnv.js';
import {resolveConfiguredParallelScraperConcurrency} from '../scraper-support/utils/parallelConcurrency.js';
const options=parseTrialOptions(process.argv.slice(2));
const scrapeEnv=buildLocalScrapeRunEnv();
const scraperConcurrency=resolveConfiguredParallelScraperConcurrency(scrapeEnv.SCRAPER_CONCURRENCY);
const runDir=path.resolve(options.runDir),outputDir=path.join(runDir,options.outputName);
await fs.mkdir(outputDir,{recursive:true});
const catalog=buildScrapers().map(s=>({source:s.name,company:s.provider?.companyName||null}));
const policyHash=createHash('sha256').update(TRIAL_POLICY).update(JSON.stringify({modelThreads:options.threads}));
for(const file of ['../rewriting/trialRephrase.js','../rewriting/factPlan.js','../rewriting/model.json','../src/services/jobDescriptionPolicy.js'])policyHash.update(await fs.readFile(new URL(file,import.meta.url)));
const policyIdentity=policyHash.digest('hex');
let prior;
if(options.resume){
 prior=JSON.parse(await fs.readFile(path.join(runDir,'trial-status.json'),'utf8'));
 const checkpoint=JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8'));
 const previousCatalog=JSON.parse(await fs.readFile(path.join(runDir,'scope.json'),'utf8')).catalog;
 const previousPid=Number((await fs.readFile(path.join(runDir,'trial.pid'),'utf8')).trim());let ownerAlive=false;
 if(!Number.isInteger(previousPid)||previousPid<=0)throw new Error('Invalid previous trial owner');
 try{process.kill(previousPid,0);ownerAlive=true;}catch(error){if(error.code!=='ESRCH')throw error;}
 assertTrialResume({prior,checkpoint,previousCatalog,catalog,ownerAlive});
 await fs.copyFile(path.join(runDir,'trial-status.json'),path.join(runDir,'trial-status-'+Date.now()+'.json'));
 await fs.rm(path.join(runDir,'trial-stop-request.json'),{force:true});await fs.rm(path.join(runDir,'stop-request.json'),{force:true});
}else{
 for(const file of ['run-state.json','run-metadata.json','trial-status.json','trial.pid']){try{await fs.access(path.join(runDir,file));throw new Error('Trial directory already used: '+file);}catch(error){if(error.code!=='ENOENT')throw error;}}
 await writeFileAtomically(path.join(runDir,'scope.json'),JSON.stringify({total:catalog.length,catalog},null,2)+String.fromCharCode(10));
}
const controller=new AbortController(),signal=controller.signal;
let report={runId:path.basename(runDir),mode:'dry-run',mongoWrites:0,policy:TRIAL_POLICY,policyIdentity,startedAt:new Date().toISOString(),status:'starting',settings:{scraperConcurrency,detailConcurrency:1,modelThreads:options.threads,cpuLimit:90,memoryLimit:90,resourceIntervalMs:2000,workdayDetailBudgetMs:480000,sourceLifecycleBudgetMs:600000},summary:{totalSources:catalog.length,jobsReviewed:0,generationAttempts:0,generated:0,draftsPassedChecks:0,sourceRetained:0},captures:{},cases:{}};
try{const old=JSON.parse(await fs.readFile(path.join(outputDir,'summary.json'),'utf8'));if(!options.resume||old.policyIdentity!==policyIdentity)throw new Error('Use a new rewrite output directory for a changed policy');report={...old,resumedAt:new Date().toISOString(),status:'starting'};delete report.error;delete report.stop;delete report.finishedAt;}catch(error){if(error.code!=='ENOENT')throw error;}
report.settings={...report.settings,scraperConcurrency,modelThreads:options.threads,workdayDetailBudgetMs:480000,sourceLifecycleBudgetMs:600000};report.rewriteDirectory=options.outputName;
let worker,client,scrapePromise,scrapeSettled=false,scrapeExitCode=null,stopReason=null,workerStopping;
const save=async()=>{report.updatedAt=new Date().toISOString();await writeFileAtomically(path.join(outputDir,'summary.json'),JSON.stringify(report,null,2)+'\n');};
const stopOwnedWorker=()=>{if(!workerStopping)workerStopping=worker?.stop();return workerStopping;};
const requestStop=async(reading,reason)=>{if(stopReason)return;stopReason=reason;report.status=reason==='resource_limit'?'resource_stopped':reason==='monitor_error'?'monitor_error':'interrupted';report.stop={reason,reading,at:new Date().toISOString()};controller.abort(new Error(reason));
 await fs.writeFile(path.join(runDir,'stop-request.json'),JSON.stringify({reason,signal:'SIGTERM',requestedAt:new Date().toISOString()})+'\n').catch(()=>{});
 await stopOwnedWorker();
};
const metrics={limit:90,peakCpuPercent:prior?.resources?.peakCpuPercent||0,peakMemoryPercent:prior?.resources?.peakMemoryPercent||0,samples:prior?.resources?.samples||0};
const monitor=createResourceMonitor({onSample:async reading=>{metrics.samples++;metrics.current=reading;metrics.peakCpuPercent=Math.max(metrics.peakCpuPercent,reading.cpuPercent||0);metrics.peakMemoryPercent=Math.max(metrics.peakMemoryPercent,reading.memoryPercent);
 await fs.appendFile(path.join(runDir,'resources.ndjson'),JSON.stringify(reading)+'\n');
 if(metrics.samples%5===0||reading.cpuPercent>90||reading.memoryPercent>90||metrics.samples===1)await writeFileAtomically(path.join(runDir,'resources-status.json'),JSON.stringify(metrics,null,2)+'\n');
},onStop:requestStop});
for(const s of ['SIGINT','SIGTERM'])process.once(s,()=>{void requestStop(null,'signal');});
const stopPoll=setInterval(async()=>{try{await fs.access(path.join(runDir,'trial-stop-request.json'));await requestStop(null,'user_stop');}catch(error){if(error.code!=='ENOENT')await requestStop(null,'monitor_error');}},2000);
await fs.writeFile(path.join(runDir,'trial.pid'),String(process.pid)+'\n');
const lazyClient={generate:async(input,requestOptions)=>{signal.throwIfAborted();if(!worker){
 const runtime=await prepareRewriteRuntime({signal});signal.throwIfAborted();
 worker=await startRewriteWorker({...runtime,signal,port:18769,threads:options.threads,logFile:path.join(outputDir,'worker.log')});
 report.worker={pid:worker.pid,endpoint:worker.endpoint,threads:options.threads};await save();
 client=createTrialClient({...worker});}
 return client.generate(input,requestOptions);
}};
try{
 await monitor.start();await delay(2100,undefined,{signal});signal.throwIfAborted();
 report.status='running';await save();
 // A 30-second optional-detail budget leaves large boards with listing-only jobs.
 // Keep one detail request at a time; this stays below the ten-minute source cap.
 const env={...scrapeEnv,WORKDAY_DETAIL_FETCH_CONCURRENCY:'1',WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS:'480000',NODE_OPTIONS:'--use-system-ca',SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE:'1',SCRAPER_RAW_CAPTURE_DIRECTORY:path.join(runDir,'raw-captures'),SCRAPER_SOURCE_LIFECYCLE_TIMEOUT_MS:'600000',SCRAPER_ONLY:'',SCRAPER_START_AT:'',SCRAPER_START_AFTER:'',SCRAPER_SKIP:'',DESCRIPTION_REWRITE_MODE:'off'};
 const scrapeOptions=parseArgs(['--run-dir',runDir,'--parallel','--dry-run','--max-restarts','8','--restart-delay-seconds','5','--shutdown-grace-seconds','10']);
 scrapePromise=runResilientScrape(scrapeOptions,{env,signal}).then(code=>{scrapeExitCode=code;scrapeSettled=true;return code;},error=>{report.scrapeError=error.message;scrapeExitCode=1;scrapeSettled=true;return 1;});
 const result=await runTrialCaptureQueue({runDir,outputDir,catalog,report,client:lazyClient,signal,isScrapeSettled:()=>scrapeSettled,save,policyIdentity});
 if(!stopReason)report.status=result.drained?(scrapeExitCode===0?'complete':'scrape_failed'):'interrupted';
}catch(error){if(!stopReason){report.error=error.message;await requestStop(null,'trial_error');report.status='error';}}
finally{
 clearInterval(stopPoll);
 report.maxWorkerMemoryBytes=worker?await workerMemoryBytes(worker.pid).catch(()=>null):null;
 await stopOwnedWorker();
 if(scrapePromise){if(!scrapeSettled)await fs.writeFile(path.join(runDir,'stop-request.json'),JSON.stringify({signal:'SIGTERM',reason:stopReason||'trial_ending'})+'\n').catch(()=>{});await scrapePromise;}
 monitor.stop();
 try{const state=JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8'));report.scrape={status:state.status,completedSources:state.completedCount,totalSources:state.totalSources,failures:Object.values(state.completed||{}).filter(r=>!r.result?.success).length};}catch{}
 report.scrapeExitCode=scrapeExitCode;report.resources=metrics;report.finishedAt=new Date().toISOString();await save();await writeFileAtomically(path.join(runDir,'trial-status.json'),JSON.stringify({status:report.status,startedAt:report.startedAt,finishedAt:report.finishedAt,summary:report.summary,scrape:report.scrape,stop:report.stop,resources:metrics,mongoWrites:0},null,2)+'\n');
 console.log(JSON.stringify({status:report.status,...report.summary,stop:report.stop,mongoWrites:0}));
 if(report.status!=='complete')process.exitCode=report.status==='resource_stopped'?90:1;
}
