import fs from 'node:fs/promises';
import syncFs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {TRIAL_POLICY} from '../rewriting/trialRephrase.js';
import {createResourceMonitor} from '../rewriting/resourceGuard.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';
import {createRepeatState,advanceRepeat} from '../rewriting/trialRepeatCoordinator.js';

const backend=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){if(!['--first-run','--first-output'].includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --first-run <existing dry trial> --first-output <rewrite directory>');options[args[i]]=args[i+1];}
if(!options['--first-run']||!/^rewrites(?:-[a-z0-9][a-z0-9-]{0,48})?$/.test(options['--first-output']||''))throw new Error('Invalid repeat trial options');
const firstRun=path.resolve(options['--first-run']),stateFile=path.join(firstRun,'repeat-state.json'),lockFile=path.join(firstRun,'repeat.lock');
const writeJson=(file,value)=>writeFileAtomically(file,JSON.stringify(value,null,2)+'\n');
const optional=async file=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)throw new Error('Invalid trial owner PID');try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;if(error.code==='EPERM')return true;throw error;}};
// Exclusive lock: concurrent controllers never share an unchecked launch claim.
const lock=await fs.open(lockFile,'wx');await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()})+'\n');
const controller=new AbortController(),signal=controller.signal;
let state,monitor,stopReason;
const save=()=>{state.updatedAt=new Date().toISOString();return writeJson(stateFile,state);};
const stopOwnedTrial=async reason=>{
 const current=state?.second||state?.first;
 if(current)await fs.writeFile(path.join(current.runDir,'trial-stop-request.json'),JSON.stringify({reason,requestedAt:new Date().toISOString()})+'\n').catch(error=>{if(error.code!=='ENOENT')console.error('Unable to write owned trial stop request: '+error.message);});
};
const stop=async(reading,reason)=>{
 if(stopReason)return;stopReason=reason;controller.abort(new Error(reason));
 if(state){state.status=['resource_limit','monitor_error'].includes(reason)?'safety_stopped':'stopped';state.stop={reason,reading,at:new Date().toISOString()};await stopOwnedTrial(reason);await save();}
};
const policyIdentity=async threads=>{
 const digest=createHash('sha256').update(TRIAL_POLICY).update(JSON.stringify({modelThreads:threads}));
 for(const file of ['../rewriting/trialRephrase.js','../rewriting/factPlan.js','../rewriting/model.json','../src/services/jobDescriptionPolicy.js'])digest.update(await fs.readFile(new URL(file,import.meta.url)));
 return digest.digest('hex');
};
const runtimeFiles=['scripts/trialCatalogDescriptions.js','scripts/resilientLocalScrape.js','rewriting/trialControl.js','rewriting/trialCaptureQueue.js','rewriting/trialQueue.js','rewriting/resourceGuard.js','rewriting/worker.js'];
const runtimeIdentity=async()=>{const digest=createHash('sha256');for(const file of runtimeFiles)digest.update(file).update(await fs.readFile(path.join(backend,file)));return digest.digest('hex');};
const readSnapshot=async current=>{
 const report=await optional(path.join(current.runDir,current.outputName,'summary.json'));
 if(!report)return null;
 let ownerAlive=false;try{ownerAlive=alive(Number((await fs.readFile(path.join(current.runDir,'trial.pid'),'utf8')).trim()));}catch(error){if(error.code!=='ENOENT')throw error;}
 return {report,checkpoint:await optional(path.join(current.runDir,'run-state.json')),terminal:await optional(path.join(current.runDir,'trial-status.json')),analysis:await optional(path.join(current.runDir,'analysis','complete.json')),ownerAlive,workerAlive:report.worker?.pid?alive(report.worker.pid):false};
};
const launch=async current=>{
 if(await policyIdentity(current.modelThreads)!==current.expectedPolicy||await runtimeIdentity()!==current.runtimeIdentity)throw new Error('Trial policy/runtime changed while the second trial was queued');
 const previousCatalog=JSON.parse(await fs.readFile(path.join(current.first.runDir,'scope.json'),'utf8')).catalog.map(c=>c.source);
 const inspectCode="import {buildScrapers} from './scraper-support/providers/index.js';console.log(JSON.stringify(buildScrapers().map(s=>s.name)));";
 const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',inspectCode],{cwd:backend,windowsHide:true,signal,maxBuffer:2*1024*1024,timeout:60000});
 if(JSON.stringify(JSON.parse(stdout))!==JSON.stringify(previousCatalog))throw new Error('Configured catalog changed while repeat was queued');
 signal.throwIfAborted();
 await fs.mkdir(current.second.runDir,{recursive:false});
 const fd=syncFs.openSync(path.join(current.second.runDir,'launcher.log'),'a');
 try{
  const child=spawn(process.execPath,['--use-system-ca',path.join(backend,'scripts/trialCatalogDescriptions.js'),'--run-dir',current.second.runDir,'--rewrite-directory',current.second.outputName,'--model-threads',String(current.modelThreads)],{cwd:backend,windowsHide:true,detached:true,stdio:['ignore',fd,fd]});
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();return child.pid;
 }finally{syncFs.closeSync(fd);}
};
try{
 const existing=await optional(stateFile);
 if(existing){state=existing;if(state.first.runDir!==firstRun||state.first.outputName!==options['--first-output']||state.mongoWrites!==0||state.totalTrials!==2)throw new Error('Repeat state does not match this dry trial');}
 else{
  const report=await optional(path.join(firstRun,options['--first-output'],'summary.json'));
  if(!report||report.mongoWrites!==0||report.mode!=='dry-run'||report.settings.modelThreads!==4)throw new Error('A four-thread existing dry trial is required');
  state=createRepeatState({firstRun,outputName:options['--first-output'],report});state.runtimeIdentity=await runtimeIdentity();
  if(await policyIdentity(state.modelThreads)!==state.expectedPolicy)throw new Error('Active policy differs from its current files');
 }
 state.coordinatorPid=process.pid;await save();
 monitor=createResourceMonitor({onSample:reading=>{state.resources={...state.resources,current:reading,peakCpuPercent:Math.max(state.resources?.peakCpuPercent||0,reading.cpuPercent||0),peakMemoryPercent:Math.max(state.resources?.peakMemoryPercent||0,reading.memoryPercent)};},onStop:stop});
 await monitor.start();await delay(2100,undefined,{signal});
 for(const name of ['SIGINT','SIGTERM'])process.once(name,()=>{void stop(null,'signal');});
 console.log(JSON.stringify({status:state.status,first:state.first,plannedSecondRun:state.plannedSecondRun,mongoWrites:0}));
 while(!signal.aborted&&!['complete','safety_stopped','error','stopped'].includes(state.status)){
  try{await fs.access(path.join(firstRun,'repeat-stop-request.json'));await stop(null,'user_stop');break;}catch(error){if(error.code!=='ENOENT')throw error;}
  const current=state.second||state.first,snapshot=await readSnapshot(current);
  if(state.status==='launching_second'){
   if(snapshot){state.status='waiting_second';await save();}
   else if(Date.now()-Date.parse(state.second.claimedAt)>120000)throw new Error('Second launch is uncertain; no automatic duplicate launch');
  }
  if(snapshot&&!snapshot.ownerAlive&&['starting','running'].includes(snapshot.report.status))throw new Error('Trial owner exited without a final report');
  if(snapshot&&!snapshot.ownerAlive&&['interrupted','error'].includes(snapshot.report.status)&&snapshot.terminal?.finishedAt===snapshot.report.finishedAt)throw new Error('Trial interrupted before full completion');
  await advanceRepeat({state,stateFile,snapshot,launch,signal});
  if(state.status==='safety_stopped'||state.status==='stopped'){await stopOwnedTrial(state.stop?.reason||state.status);break;}
  if(state.status==='complete')break;
  await delay(15000,undefined,{signal});
 }
}catch(error){
 if(!stopReason&&state){state.status='error';state.error={message:error.message,at:new Date().toISOString()};await stopOwnedTrial('repeat_error');await save();}
 console.error(error.message);if(!stopReason)process.exitCode=1;
}finally{
 monitor?.stop();if(state)await save();await lock.close();await fs.rm(lockFile,{force:true});
 if(state?.status==='safety_stopped')process.exitCode=90;
 console.log(JSON.stringify({status:state?.status,second:state?.second||null,mongoWrites:0}));
}
