/** Local experiment supervisor. No publishing; memory cutoff survives chat disconnects. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createResourceSampler,createResourceMonitor} from '../rewriting/resourceGuard.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';
import {capturedSourceNames} from '../rewriting/capturedSources.js';
import {REWRITE_MODEL} from '../src/services/jobDescriptionPolicy.js';

const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exec=promisify(execFile);
const save=(file,value)=>writeFileAtomically(file,JSON.stringify(value,null,2)+'\n');

const withinShutdownDeadline=async(promise,timeoutMs,label)=>{
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(`${label} timed out after ${timeoutMs}ms`)),timeoutMs);
  })]);}finally{clearTimeout(timer);}
};

const terminateChildTree=async(child,{timeoutMs})=>{
  if(process.platform==='win32'){
    await exec('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:timeoutMs});
  }else if(!child.kill('SIGKILL')){
    throw new Error('Could not terminate the supervised child');
  }
};

export async function runMemoryLimitedChild({
  runDir,command,args,sample=createResourceSampler(),intervalMs=2000,onReading=()=>{},env=process.env,
  terminateChild=terminateChildTree,shutdownTimeoutMs=5000,
}) {
  if(!Number.isSafeInteger(shutdownTimeoutMs)||shutdownTimeoutMs<1)throw new Error('Invalid child shutdown timeout');
  let child,finished=false,childExit,stopReason=null,stopReading,stopPromise;
  let stdout,stderr,userStopPoll,primaryError,result,reportStopFailure;
  const stopFailure=new Promise(resolve=>{reportStopFailure=resolve;});
  const stop=(reading,reason)=>{
    if(stopReason)return stopPromise;
    stopReason=reason;stopReading=reading;
    stopPromise=(async()=>{
      // Persist the cutoff even if process termination is denied.
      await save(path.join(runDir,'memory-stop.json'),{reason,reading,at:new Date().toISOString(),childPid:child?.pid||null,automaticResume:false});
      if(child&&!finished&&child.pid){
        // This handle belongs only to this invocation. The default Windows
        // operation also terminates descendants, with a bounded wait.
        await withinShutdownDeadline(Promise.resolve().then(()=>terminateChild(child,{timeoutMs:shutdownTimeoutMs})),
          shutdownTimeoutMs,'Child termination');
        await withinShutdownDeadline(childExit,shutdownTimeoutMs,'Child exit after termination');
      }
    })();
    // Signal callbacks and timers cannot reject the caller's child-exit wait
    // directly; bridge their failure into that wait.
    void stopPromise.catch(reportStopFailure);
    return stopPromise;
  };
  const monitor=createResourceMonitor({limit:90,intervalMs,
    sample:async()=>{const reading=await sample();return {...reading,hostCpuPercent:reading.cpuPercent,cpuPercent:null};},
    onSample:async reading=>{await fs.appendFile(path.join(runDir,'resources.ndjson'),JSON.stringify(reading)+'\n');await onReading(reading);},onStop:stop});
  const stopped=()=>{void stop(null,'user_stop').catch(reportStopFailure);};
  let userStopBusy=false;
  const checkUserStop=async()=>{
    if(userStopBusy)return;
    userStopBusy=true;
    try{
      try{await fs.access(path.join(runDir,'user-stop'));}
      catch(error){if(error.code==='ENOENT')return;await stop({error:error.message},'monitor_error');return;}
      await stop(null,'user_stop');
    }finally{userStopBusy=false;}
  };
  try {
    await monitor.start();
    let outcome={};
    if(!stopReason){
      stdout=await fs.open(path.join(runDir,'pipeline.log'),'a');
      stderr=await fs.open(path.join(runDir,'pipeline.err.log'),'a');
    }
    // A periodic sample may breach the threshold while the files are opening.
    if(!stopReason){
      process.once('SIGINT',stopped);process.once('SIGTERM',stopped);
      userStopPoll=setInterval(()=>{void checkUserStop().catch(reportStopFailure);},intervalMs);
      child=spawn(command,args,{cwd:backend,env,windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});
      childExit=new Promise((resolve,reject)=>{
        child.once('error',reject);
        child.once('exit',(code,signal)=>{finished=true;resolve({code,signal});});
      });
      const settled=Promise.race([childExit,stopFailure.then(error=>{throw error;}),monitor.failure.then(error=>{throw error;})]);
      // Attach before the asynchronous checkpoint so an early spawn error is
      // observed even if the checkpoint itself also fails.
      void settled.catch(()=>{});
      await save(path.join(runDir,'active-child.json'),{pid:child.pid,command,args,startedAt:new Date().toISOString()});
      outcome=await settled;
    }
    await stopPromise;
    result={status:stopReason?(stopReason==='user_stop'?'interrupted':stopReason==='monitor_error'?'monitor_error':'resource_stopped'):'exited',reason:stopReason,reading:stopReading,exitCode:stopReason?90:outcome.code,signal:outcome.signal};
  } catch(error) {
    primaryError=error;
  } finally {
    monitor.stop();clearInterval(userStopPoll);process.removeListener('SIGINT',stopped);process.removeListener('SIGTERM',stopped);
    const cleanupErrors=[];
    if(child?.pid&&!finished){
      // A denied tree kill must not leave this invocation's direct child alive.
      // Preserve the original failure: direct-child cleanup cannot claim that
      // descendants were terminated successfully.
      try{
        if(!child.kill('SIGKILL')&&!finished)throw new Error('Could not clean up the supervised child');
        await withinShutdownDeadline(childExit,shutdownTimeoutMs,'Supervised child cleanup');
      }catch(error){cleanupErrors.push(error);child.unref();}
    }
    for(const handle of [stdout,stderr]){
      if(handle)try{await handle.close();}catch(error){cleanupErrors.push(error);}
    }
    if(cleanupErrors.length){
      primaryError=new AggregateError([...(primaryError?[primaryError]:[]),...cleanupErrors],
        'Child supervisor failed during cleanup',{cause:primaryError||cleanupErrors[0]});
    }
  }
  if(primaryError)throw primaryError;
  return result;
}

export async function runFullDescriptionDryRun({runDir,sourceCount='all',concurrency=10,resumeDescriptions=false}) {
  runDir=path.resolve(runDir);
  await fs.mkdir(runDir,{recursive:true});
  const statusFile=path.join(runDir,'pipeline-status.json');
  let prior;
  if(resumeDescriptions){
    prior=JSON.parse(await fs.readFile(statusFile,'utf8'));
    if(prior.status!=='error'||prior.mongoWrites!==0||prior.stop?.reason)throw new Error('Only a failed local description stage can resume; resource-stopped runs remain stopped.');
    try{process.kill(prior.ownerPid,0);throw new Error('Previous supervisor is still alive');}catch(error){if(error.code!=='ESRCH')throw error;}
    for(const file of ['memory-stop.json','user-stop']){try{await fs.access(path.join(runDir,file));throw new Error('A stopped run cannot automatically resume');}catch(error){if(error.code!=='ENOENT')throw error;}}
    capturedSourceNames(JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8')));
    await fs.copyFile(statusFile,path.join(runDir,'pipeline-status-before-recovery-'+Date.now()+'.json'));
  }else{try{await fs.access(statusFile);throw new Error('Use a new run directory; resource-stopped runs remain stopped.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const report=prior?{...prior,status:'starting',stage:'description_recovery',ownerPid:process.pid,resumedAt:new Date().toISOString()}:{status:'starting',stage:'starting',startedAt:new Date().toISOString(),ownerPid:process.pid,mongoWrites:0,
    settings:{sourceCount,scraperConcurrency:concurrency,memoryLimitPercent:90,memoryIntervalMs:2000,model:REWRITE_MODEL.modelId,modelFile:REWRITE_MODEL.file,modelRevision:REWRITE_MODEL.revision,modelThreads:4,modelSlots:1,promptCacheMiB:128,verify:'description sections only'},
    resources:{samples:0,peakMemoryPercent:0},stages:[]};
  delete report.finishedAt;delete report.stop;delete report.error;
  const checkpoint=()=>save(statusFile,{...report,updatedAt:new Date().toISOString()});
  await checkpoint();await fs.writeFile(path.join(runDir,'supervisor.pid'),String(process.pid)+'\n');
  const onReading=async reading=>{report.resources.samples++;report.resources.current=reading;report.resources.peakMemoryPercent=Math.max(report.resources.peakMemoryPercent,reading.memoryPercent);if(report.resources.samples%5===0||reading.memoryPercent>90||report.resources.samples===1)await checkpoint();};
  const env={...process.env,MONGO_URI:'',JOB_DESCRIPTION_REWRITE_MODE:'off',TELEGRAM_ENABLED:'false',NODE_OPTIONS:'--max-old-space-size=6144',SCRAPER_DISABLE_DRY_RUN_PUBLIC_EXPERIENCE:'1'};
  const stage=async(name,args)=>{
    report.status='running';report.stage=name;const startedAt=new Date().toISOString();await checkpoint();
    const outcome=await runMemoryLimitedChild({runDir,command:process.execPath,args,env,onReading});
    report.stages.push({name,startedAt,finishedAt:new Date().toISOString(),...outcome});await checkpoint();
    if(outcome.status!=='exited'||outcome.exitCode!==0){report.status=outcome.status==='exited'?'error':outcome.status;report.stop=outcome;return false;}return true;
  };
  try {
    if(!resumeDescriptions&&!await stage('scraping',['--use-system-ca','--use-env-proxy','scripts/trialPostScrapeClassification.js',runDir,String(sourceCount),String(concurrency)]))return report;
    const state=JSON.parse(await fs.readFile(path.join(runDir,'run-state.json'),'utf8'));
    if(state.status!=='complete'||state.completedCount!==state.totalSources)throw new Error('Scrape did not finish the complete selected catalog; model stage blocked.');
    const sources=capturedSourceNames(state);
    const values=Object.values(state.completed||{});
    report.scrape={completedSources:state.completedCount,totalSources:state.totalSources,failedSources:values.filter(r=>!r.result?.success).length};
    await save(path.join(runDir,'scrape-summary.json'),{status:'complete',mongoWrites:0,selectedSources:sources.map((source,i)=>({index:i+1,source})),summary:report.scrape});
    report.rewriteDirectory='9000m-t4-slots1-arrival-full-final-snapshots';
    if(!await stage('descriptions',['--use-system-ca','scripts/benchmarkSmallDescriptionModels.js','--phase','consume','--run-dir',runDir,'--model','9000','--threads','4','--slots','1','--workers','1','--port','18772','--prompt-cache','--preserve-source-context','--all-descriptions','--final-snapshots','--label','full-final-snapshots']))return report;
    const result=JSON.parse(await fs.readFile(path.join(runDir,report.rewriteDirectory,'summary.json'),'utf8'));
    report.descriptions=result.summary;report.descriptionsStatus=result.status;
    report.status=result.status==='complete'?'complete':'error';report.stage='finished';
  } catch(error){report.status='error';report.error=error.message;}
  finally{report.finishedAt=new Date().toISOString();await checkpoint();}
  return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const i=process.argv.indexOf('--run-dir');if(i<0||!process.argv[i+1])throw new Error('Use --run-dir <fresh experiment directory>');
  const report=await runFullDescriptionDryRun({runDir:process.argv[i+1],resumeDescriptions:process.argv.includes('--resume-descriptions')});
  console.log(JSON.stringify(report));if(report.status!=='complete')process.exitCode=report.status==='resource_stopped'?90:1;
}
