import PipelineRun from '../models/PipelineRun.js';
import { WORKFLOWS, isTerminal } from './policy.js';
import { changeRun, completeWorkflow, createPipeline, dispatchNext, failPipeline, pipelineError } from './execution.js';

/** Refresh a missed completion before a scheduled/manual workflow claims the shared slot. */
export async function createDirectGithubPipeline(options,{token=process.env.GITHUB_PAT}={}) {
  const active=await PipelineRun.findOne({activeKey:'database'}).lean();
  // Another tick can claim this interval after the caller's slot lookup.
  if(options.scheduleSlot&&active?.scheduleSlot===options.scheduleSlot) {
    throw pipelineError('This scheduled interval already started.',409,{scheduleAlreadyClaimed:true});
  }
  // A GitHub worker cannot establish the liveness of another repository or local process.
  if(active?.target==='github'&&active.repo===options.repo)await reconcileGithub(active,{token});
  try { return await createPipeline(options); }
  catch(error) {
    if(error.status===409&&error.activeRun) {
      const run=error.activeRun;
      const stage=run.stages.find(s=>['queued','preparing','running'].includes(s.status));
      const workflow=stage?.githubRunId?` GitHub run ${stage.githubRunId}.`:'';
      error.message=`A pipeline is already active: ${run._id} (${run.target}, ${stage?.key||run.status}).${workflow} Wait for it to finish, or cancel it through pipeline controls before starting a new run.`;
    }
    throw error;
  }
}

export async function githubRequest(repo,endpoint,{token=process.env.GITHUB_PAT,method='GET',body}={}) {
  if(!token||!/^[-\w.]+\/[-\w.]+$/.test(repo||''))throw pipelineError('Configure GITHUB_REPO and GITHUB_PAT with Actions read/write access.',503);
  let response;
  try { response=await fetch(`https://api.github.com/repos/${repo}${endpoint}`,{method,
    headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)}); }
  catch { throw pipelineError('GitHub could not be reached. Refresh status to reconcile the run.',502); }
  if(!response.ok) {
    const details=await response.json().catch(()=>null);
    throw pipelineError(`GitHub returned ${response.status}. Check workflow deployment and repository Actions permissions.`,502,{
      githubStatus:response.status,githubMessage:typeof details?.message==='string'?details.message.slice(0,1000):'',
    });
  }
  return response.status===204?null:response.json();
}
export const dispatchGithubStage=(run,stage,token=process.env.GITHUB_PAT)=>githubRequest(run.repo,`/actions/workflows/${WORKFLOWS[stage.key]}/dispatches`,{
  token,method:'POST',body:{ref:run.ref,inputs:{pipeline_id:run._id,dispatch_token:stage.dispatchToken,pipeline_sha:run.sha||''}},
});

/** Keep internal dispatch identity in step metadata while accepting older job names. */
export async function matchesGithubStage(repo,remote,stage,token=process.env.GITHUB_PAT) {
  if(!stage.dispatchToken)return false;
  // Previously dispatched workflows still carry identity in their title.
  if((remote.display_title||remote.name||'').includes(stage.dispatchToken))return true;
  const label={scraper:'Scraper',rewrite:'Description Rewrite',classification:'Job Classification'}[stage.key];
  if(!label||!new RegExp(`^${label} #\\d+$`).test(remote.display_title||''))return false;
  const data=await githubRequest(repo,`/actions/runs/${remote.id}/jobs?per_page=100`,{token});
  const marker=`${label} [dispatch:${stage.dispatchToken}]`;
  return data.jobs?.some(job=>job.name===marker||job.steps?.some(step=>step.name===marker))||false;
}

/** Repair missed observer events using exact run IDs/tokens, never the latest unrelated run. */
export async function reconcileGithub(run,{token=process.env.GITHUB_PAT,advance=true}={}) {
  if(!run||run.target!=='github'||isTerminal(run.status))return run;
  const stage=run.stages.find(s=>['queued','preparing','running'].includes(s.status));
  if(!stage) {
    if(advance)await dispatchNext(run._id,(row,next)=>dispatchGithubStage(row,next,token));
    return PipelineRun.findById(run._id).lean();
  }
  let remote;
  if(stage.githubRunId) remote=await githubRequest(run.repo,`/actions/runs/${stage.githubRunId}`,{token});
  else {
    const data=await githubRequest(run.repo,`/actions/workflows/${WORKFLOWS[stage.key]}/runs?event=workflow_dispatch&per_page=100`,{token});
    for(const candidate of data.workflow_runs||[]) {
      if(await matchesGithubStage(run.repo,candidate,stage,token)){remote=candidate;break;}
    }
    if(remote)await changeRun(run._id,row=>{
      const current=row.stages.find(s=>s.key===stage.key);
      if(current.status!=='queued')return false;
      current.githubRunId=remote.id;
      if(remote.status==='completed'){current.status='preparing';current.startedAt=new Date(remote.run_started_at||remote.created_at);}
    });
  }
  // Downtime before the first recovery attempt must not exhaust the retry
  // window: an undispatched weekly occurrence still deserves a start.
  const waitingSince=run.origin==='scheduler'&&stage.status==='queued'?stage.recoveryStartedAt:stage.queuedAt;
  if(remote?.status==='completed'&&advance) {
    await completeWorkflow(remote.id,remote.conclusion,(row,next)=>dispatchGithubStage(row,next,token));
  } else if(!remote&&waitingSince&&Date.now()-new Date(waitingSince).getTime()>24*60*60*1000) {
    await failPipeline(run._id,'failed','No matching GitHub run appeared within 24 hours.');
  } else if(!remote&&advance&&run.origin==='scheduler'&&stage.status==='queued') {
    // Recover a crash after queue persistence but before the POST. Redeliver
    // the same token: claimStage allows only one GitHub worker to execute it.
    const retry=await changeRun(run._id,row=>{
      const current=row.stages.find(s=>s.key===stage.key);
      if(isTerminal(row.status)||current?.status!=='queued'||current.githubRunId
        ||Date.now()-new Date(current.lastDispatchAttemptAt||current.queuedAt).getTime()<5*60*1000)return false;
      current.lastDispatchAttemptAt=new Date();
      current.recoveryStartedAt ||= new Date();
    });
    if(retry)await dispatchGithubStage(retry,retry.stages.find(s=>s.key===stage.key),token);
  }
  return PipelineRun.findById(run._id).lean();
}
