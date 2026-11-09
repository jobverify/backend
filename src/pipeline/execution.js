import { randomUUID } from 'node:crypto';
import PipelineRun from '../models/PipelineRun.js';
import { createStages, validateConfiguration, isTerminal, describeStageCompletion } from './policy.js';

export const pipelineError=(message,status=409,extra={})=>Object.assign(new Error(message),{status,...extra});
export async function createPipeline({configuration,target,origin,repo,ref,sha,requestedBy,localOwner,initialRunId,scheduleSlot}) {
  validateConfiguration(configuration);
  await PipelineRun.init();
  await PipelineRun.collection.createIndex({activeKey:1},{unique:true,sparse:true});
  if(scheduleSlot)await PipelineRun.collection.createIndex({scheduleSlot:1},{unique:true,sparse:true});
  const stages=createStages(configuration);
  if(initialRunId)Object.assign(stages.find(s=>s.enabled),{status:'preparing',startedAt:new Date(),githubRunId:Number(initialRunId)});
  try { return (await PipelineRun.create({_id:randomUUID(),activeKey:'database',origin,target,repo,ref,sha,requestedBy,localOwner,
    ...(scheduleSlot?{scheduleSlot}:{}),heartbeatAt:new Date(),startedAt:new Date(),stages})).toObject(); }
  catch(error) {
    if(error.code===11000&&scheduleSlot&&await PipelineRun.exists({scheduleSlot}))throw pipelineError('This scheduled interval already started.',409,{scheduleAlreadyClaimed:true});
    if(error.code===11000)throw pipelineError('A pipeline is already active.',409,{activeRun:await PipelineRun.findOne({activeKey:'database'}).lean()});
    throw error;
  }
}
/** Optimistic writes keep stage transitions and the database-wide execution slot atomic. */
export async function changeRun(id, transform) {
  for(let attempt=0;attempt<12;attempt++) {
    const run=await PipelineRun.findById(id).lean();
    if(!run)throw pipelineError('Pipeline not found.',404);
    if(transform(run)===false)return null;
    const revision=run.revision;delete run._id;delete run.__v;
    run.revision=revision+1;
    const release=!run.activeKey;delete run.activeKey;
    const updated=await PipelineRun.findOneAndUpdate({_id:id,revision},{$set:run,...(release?{$unset:{activeKey:1}}:{})},{new:true}).lean();
    if(updated)return updated;
  }
  throw pipelineError('Pipeline changed concurrently. Refresh and try again.');
}
function stop(run,status,error) {
  run.status=status;run.error=error;run.completedAt=new Date();delete run.activeKey;
  for(const stage of run.stages) {
    if(['preparing','running'].includes(stage.status)){stage.status=status;stage.completedAt=new Date();}
    else if(['waiting','queued'].includes(stage.status))stage.status='blocked';
  }
}
export async function failPipeline(id,status,error) {
  return changeRun(id,run=>{if(isTerminal(run.status))return false;stop(run,status,error);});
}
export async function dispatchNext(id,dispatch) {
  let selected;
  const run=await changeRun(id,row=>{
    if(isTerminal(row.status)||row.stages.some(s=>['queued','preparing','running'].includes(s.status)))return false;
    const stage=row.stages.find(s=>s.status==='waiting');
    if(!stage){row.status='completed';row.completedAt=new Date();delete row.activeKey;return;}
    stage.status='queued';stage.queuedAt=new Date();stage.dispatchToken=randomUUID();selected=stage.key;
  });
  if(!run||!selected)return run;
  const stage=run.stages.find(s=>s.key===selected);
  try { await dispatch(run,stage); }
  catch(error) {
    await changeRun(id,row=>{
      const current=row.stages.find(s=>s.key===selected);
      // A timeout can occur after GitHub accepted the dispatch. Never stop a worker already bound to this token.
      if(current.status!=='queued'||current.githubRunId)return false;
      current.status='failed';current.completedAt=new Date();current.error='Workflow dispatch failed. Check repository Actions access.';
      stop(row,'failed',current.error);
    });
    throw pipelineError('Workflow dispatch failed. Check repository Actions access.',502);
  }
  return run;
}
export async function claimStage(id,key,{runId,token,owner}={}) {
  const run=await changeRun(id,row=>{
    if(isTerminal(row.status))throw pipelineError('Pipeline is no longer active.');
    const stage=row.stages.find(s=>s.key===key);
    if(!stage||stage.status!=='queued'||stage.dispatchToken!==token)throw pipelineError('This stage has already been claimed or its dispatch identity is invalid.');
    stage.status='preparing';stage.startedAt=new Date();stage.githubRunId=runId;stage.owner=owner;
  });
  return run;
}
export async function updateStage(id,key,values) {
  return changeRun(id,row=>{
    if(isTerminal(row.status))return false;
    const stage=row.stages.find(s=>s.key===key);
    if(!stage||!['preparing','running'].includes(stage.status))return false;
    Object.assign(stage,values);
  });
}
export const recordStageResult=(id,key,{outcome,summary})=>updateStage(id,key,{processingOutcome:outcome,summary:describeStageCompletion(key,summary,outcome)});
export async function completeWorkflow(runId,conclusion,dispatch) {
  const existing=await PipelineRun.findOne({'stages.githubRunId':Number(runId)}).lean();
  if(!existing)return null;
  const changed=await changeRun(existing._id,row=>{
    const stage=row.stages.find(s=>s.githubRunId===Number(runId));
    if(isTerminal(row.status)||!['queued','preparing','running'].includes(stage.status))return false;
    const outcome=conclusion==='cancelled'?'cancelled':stage.processingOutcome==='incomplete'?'incomplete':
      conclusion==='success'&&stage.processingOutcome==='completed'?'completed':'failed';
    stage.status=outcome;stage.completedAt=new Date();
    if(outcome!=='completed')stop(row,outcome,`Stage ${stage.key} ${outcome}.`);
  });
  if(changed?.status==='running'||(!changed&&existing.status==='running'&&existing.stages.some(s=>s.githubRunId===Number(runId)&&s.status==='completed')))return dispatchNext(existing._id,dispatch);
  return changed;
}
export async function completeLocalStage(id,key,outcome,summary) {
  return changeRun(id,row=>{
    if(isTerminal(row.status))return false;
    const stage=row.stages.find(s=>s.key===key);stage.status=outcome;stage.summary=describeStageCompletion(key,summary,outcome);stage.completedAt=new Date();
    if(outcome!=='completed')stop(row,outcome,`Stage ${key} ${outcome}.`);
  });
}
