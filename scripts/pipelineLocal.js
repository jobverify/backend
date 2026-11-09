import '../loadEnv.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import mongoose from 'mongoose';
import { configureMongoDns } from '../src/utils/mongoDns.js';
import PipelineRun from '../src/models/PipelineRun.js';
import { backendRoot, localLogPath, localEnabled, redactLog } from '../src/pipeline/local.js';
import { dispatchNext, claimStage, updateStage, completeLocalStage, failPipeline } from '../src/pipeline/execution.js';
import { stageOutcome } from '../src/pipeline/policy.js';
import { prepareLocalStage } from '../src/pipeline/localPreparation.js';

const id=process.argv[2];let child,heartbeat,logPath,currentKey,stopping=false,ownsRun=false;
const log=async text=>{if(logPath)await fs.appendFile(logPath,redactLog(text));};
async function command(executable,args,env={}) {
  if(stopping)throw new Error('Local pipeline interrupted');
  await log(`\n> ${path.basename(executable)} ${args.map(a=>/mongodb|token/i.test(a)?'[redacted]':a).join(' ')}\n`);
  return new Promise((resolve,reject)=>{
    child=spawn(executable,args,{cwd:backendRoot,env:{...process.env,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let writes=Promise.resolve();
    const append=data=>{writes=writes.then(()=>log(data.toString())).catch(()=>{});};
    child.stdout.on('data',append);child.stderr.on('data',append);
    child.once('error',reject);child.once('exit',code=>{child=null;void writes.then(()=>resolve(code??1));});
  });
}
async function prepare(key) {
 return prepareLocalStage(key,{run:command,log,prepareRewrite:async()=>{
   const {prepareRewriteRuntime}=await import('../rewriting/worker.js');await prepareRewriteRuntime();
 }});
}
async function shutdown() {
  stopping=true;
  if(child?.pid) {
    if(process.platform==='win32')spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    else child.kill('SIGTERM');
  }
  await failPipeline(id,'interrupted','Local worker interrupted.').catch(()=>{});
}
process.once('SIGTERM',()=>void shutdown());process.once('SIGINT',()=>void shutdown());
try {
  if(!localEnabled())throw new Error('Local execution is disabled.');
  configureMongoDns();await mongoose.connect(process.env.MONGO_URI);
  // One detached owner per pipeline, including accidental duplicate worker launches.
  const owned=await PipelineRun.findOneAndUpdate({_id:id,target:'local',activeKey:'database',localOwner:{$exists:false}},{$set:{localOwner:String(process.pid),heartbeatAt:new Date()}},{new:true}).lean();
  if(!owned)throw new Error('Local pipeline is already owned or no longer active.');
  ownsRun=true;
  heartbeat=setInterval(()=>{
    void PipelineRun.updateOne({_id:id,activeKey:'database',localOwner:String(process.pid)},{$set:{heartbeatAt:new Date()}}).then(async result=>{
      if(!result.matchedCount)await shutdown();
    }).catch(()=>void shutdown());
  },15000);
  while(!stopping) {
    const run=await PipelineRun.findById(id).lean();
    if(!run?.activeKey)break;
    const stage=run.stages.find(s=>s.status==='waiting');
    if(!stage){await dispatchNext(id,async()=>{});break;}
    await dispatchNext(id,async()=>{});
    const queued=await PipelineRun.findById(id).lean();const ready=queued.stages.find(s=>s.key===stage.key);
    currentKey=stage.key;logPath=localLogPath(id,currentKey);await fs.mkdir(path.dirname(logPath),{recursive:true});
    await claimStage(id,currentKey,{token:ready.dispatchToken,owner:String(process.pid)});
    const env=await prepare(currentKey);
    await updateStage(id,currentKey,{status:'running'});
    const summaryFile=path.join(backendRoot,'.cache/pipeline',`${id}-${currentKey}.json`);
    const common={...env,PIPELINE_SUMMARY_FILE:summaryFile,CLASSIFICATION_SUMMARY_FILE:summaryFile,
      JOB_DESCRIPTION_REWRITE_MODE:'publish',JOB_DESCRIPTION_REWRITE_BUDGET_SECONDS:'18000',
      POST_SCRAPE_CLASSIFICATION_MODE:'policy',JOB_DESCRIPTION_WORKFLOW_BUDGET_SECONDS:'21000'};
    const args=currentKey==='scraper'?['--use-system-ca','scraper-support/runner.js','--parallel']:
      currentKey==='rewrite'?['scripts/rewriteJobDescriptions.js','--apply']:['scripts/classifySavedJobs.js'];
    const progress=setInterval(()=>{void fs.readFile(summaryFile,'utf8').then(JSON.parse).then(summary=>updateStage(id,stage.key,{summary})).catch(()=>{});},5000);
    let code;try{code=await command(process.execPath,args,common);}finally{clearInterval(progress);}
    let summary={};try{summary=JSON.parse(await fs.readFile(summaryFile,'utf8'));}catch{if(currentKey!=='scraper')code=1;}
    const outcome=stageOutcome(currentKey,summary,code);
    await completeLocalStage(id,currentKey,outcome,summary);
    if(outcome!=='completed')break;
  }
}catch(error){await log(`\n${error.message}\n`);if(ownsRun&&mongoose.connection.readyState===1)await failPipeline(id,'failed','Local preparation or execution failed. See stage logs.');process.exitCode=1;}
finally{clearInterval(heartbeat);await mongoose.disconnect();}
