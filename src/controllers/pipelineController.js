import os from 'node:os';
import { getScraperSchedule, updateScraperSchedule } from '../pipeline/schedule.js';
import { pipeline } from 'node:stream/promises';
import { createPipelineBundle } from '../pipeline/download.js';
import PipelineRun from '../models/PipelineRun.js';
import PipelineConfiguration from '../models/PipelineConfiguration.js';
import AdminAudit from '../models/AdminAudit.js';
import { defaultConfiguration, validateConfiguration } from '../pipeline/policy.js';
import { createPipeline, dispatchNext, failPipeline, pipelineError } from '../pipeline/execution.js';
import { githubRequest, dispatchGithubStage, reconcileGithub } from '../pipeline/github.js';
import { localEnabled, launchLocal, reconcileLocal, readLocalLog } from '../pipeline/local.js';

export const capabilities=()=>({github:Boolean(process.env.GITHUB_PAT&&process.env.GITHUB_REPO),local:localEnabled(),localMachine:localEnabled()?os.hostname():null});
const configuration=async()=>{const saved=await PipelineConfiguration.findById('global').lean();return saved?validateConfiguration(saved):defaultConfiguration();};
const audit=async(req,action,details)=>{try{await AdminAudit.create({admin:req.user._id,action,targetType:'ScraperStatus',details});}catch{/* execution must not depend on audit availability */}};
const endpoint=fn=>async(req,res)=>{
  res.set('Cache-Control','no-store');
  try{await fn(req,res);}catch(error){res.status(error.status||500).json({success:false,message:error.status?error.message:'Pipeline request failed. Refresh and try again.',...(error.activeRun?{activeRun:error.activeRun}:{})});}
};
export const getPipelineStatus=endpoint(async(_req,res)=>{
  let run=await PipelineRun.findOne().sort({createdAt:-1}).lean();let warning=null;
  try{run=run?.target==='github'?await reconcileGithub(run):await reconcileLocal(run);}catch(error){warning=error.status?error.message:'Status could not be reconciled.';}
  res.json({success:true,data:{configuration:await configuration(),capabilities:capabilities(),run,warning}});
});
export const savePipelineConfiguration=endpoint(async(req,res)=>{
  const config=validateConfiguration(req.body);
  await PipelineConfiguration.findByIdAndUpdate('global',{$set:{...config,updatedBy:String(req.user._id)}},{upsert:true,runValidators:true});
  await audit(req,'configurePipeline',JSON.stringify(config));res.json({success:true,data:config});
});
export const getPipelineCapabilities=endpoint(async(_req,res)=>res.json({success:true,data:capabilities()}));
export const getPipelineSchedule=endpoint(async(_req,res)=>res.json({success:true,data:await getScraperSchedule()}));
export const savePipelineSchedule=endpoint(async(req,res)=>{
  const data=await updateScraperSchedule(req.body);
  await audit(req,'configureScraperSchedule',JSON.stringify(data));
  res.json({success:true,data});
});
export const triggerPipeline=endpoint(async(req,res)=>{
  const target=req.body?.target;
  if(!['github','local'].includes(target))throw pipelineError('Choose github or local execution.',400);
  if(target==='local'&&!localEnabled())throw pipelineError('Local execution is disabled on this backend.',403);
  const config=await configuration();
  const current=await PipelineRun.findOne({activeKey:'database'}).lean();
  if(current) {
    if(current.target==='local')await reconcileLocal(current);else await reconcileGithub(current);
  }
  let repo,ref,sha;
  if(target==='github') {
    repo=process.env.GITHUB_REPO;const repository=await githubRequest(repo,'');ref=repository.default_branch;
    const commit=await githubRequest(repo,`/commits/${encodeURIComponent(ref)}`);sha=commit.sha;
    // Fail before creating an active execution when a stage is not deployed or enabled.
    const {WORKFLOWS}=await import('../pipeline/policy.js');
    await Promise.all(config.stages.filter(s=>s.enabled).map(async stage=>{
      const workflow=await githubRequest(repo,`/actions/workflows/${WORKFLOWS[stage.key]}`);
      if(workflow.state!=='active')throw pipelineError(`Enable the ${stage.key} workflow in GitHub Actions.`,503);
    }));
  }
  const run=await createPipeline({configuration:config,target,origin:'admin',repo,ref,sha,requestedBy:String(req.user._id)});
  try{if(target==='local')launchLocal(run);else await dispatchNext(run._id,dispatchGithubStage);}
  catch(error){await failPipeline(run._id,'failed','Pipeline could not start.');throw error;}
  await audit(req,'triggerPipeline',`Requested ${target} pipeline ${run._id}`);
  res.status(202).json({success:true,data:await PipelineRun.findById(run._id).lean()});
});
export const getPipelineRuns=endpoint(async(req,res)=>{
  const limit=Math.min(50,Math.max(1,Number(req.query.limit)||20));
  res.json({success:true,data:await PipelineRun.find().sort({createdAt:-1}).limit(limit).lean()});
});
export const getPipelineRun=endpoint(async(req,res)=>{
  let run=await PipelineRun.findById(req.params.id).lean();if(!run)throw pipelineError('Pipeline not found.',404);
  run=run.target==='github'?await reconcileGithub(run):await reconcileLocal(run);
  res.json({success:true,data:run});
});
export const getPipelineLog=endpoint(async(req,res)=>{
  const run=await PipelineRun.findById(req.params.id).lean();
  if(!run||run.target!=='local'||!run.stages.some(s=>s.key===req.params.stage))throw pipelineError('Local stage log not found.',404);
  res.json({success:true,data:{text:await readLocalLog(run._id,req.params.stage)}});
});
export const downloadPipeline=endpoint(async(req,res)=>{
  const run=await PipelineRun.findById(req.params.id).lean();
  if(!run)throw pipelineError('Pipeline not found.',404);
  const controller=new AbortController();
  const disconnect=()=>{if(!res.writableFinished)controller.abort();};
  res.once('close',disconnect);
  let bundle;
  try{
    bundle=await createPipelineBundle(run,{signal:controller.signal,kind:req.query.kind??'all',stage:req.query.stage});
    controller.signal.throwIfAborted();
    res.attachment(bundle.filename);
    res.type('application/zip');
    await pipeline(bundle.stream,res,{signal:controller.signal});
  }catch(error){
    if(res.headersSent||res.destroyed){res.destroy();return;}
    throw error;
  }finally{
    res.off('close',disconnect);
    bundle?.stream.destroy();
    await bundle?.cleanup();
  }
});
export const retiredPipelineControl=(_req,res)=>res.status(410).json({success:false,message:'Use /api/admin/pipeline/configuration and /api/admin/pipeline/trigger to configure and execute stages.'});
