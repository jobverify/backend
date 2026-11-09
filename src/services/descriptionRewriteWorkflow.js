import {REWRITE_MODEL} from './jobDescriptionPolicy.js';

export const DESCRIPTION_WORKFLOW='rewrite-descriptions.yml';
export const DESCRIPTION_AUTO_RUN_VARIABLE='JOB_DESCRIPTION_REWRITE_AUTO_RUN';
const activeStatuses=new Set(['in_progress','queued','waiting','requested','pending']);

export class DescriptionWorkflowError extends Error {
 constructor(message,status=502,githubStatus=null){super(message);this.status=status;this.githubStatus=githubStatus;}
}

const configuration=()=>{
 const repo=process.env.GITHUB_REPO||'';
 return {repo,token:process.env.GITHUB_PAT,configured:Boolean(process.env.GITHUB_PAT&&/^[\w.-]+\/[\w.-]+$/.test(repo))};
};

async function githubRequest(endpoint,{method='GET',body,allowMissing=false}={}){
 const {repo,token,configured}=configuration();
 if(!configured)throw new DescriptionWorkflowError('Configure GITHUB_PAT and GITHUB_REPO to manage description rewriting.',503);
 let response;
 try{
  response=await fetch(`https://api.github.com/repos/${repo}${endpoint}`,{
   method,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),
  });
 }catch{throw new DescriptionWorkflowError('GitHub could not be reached. Refresh and try again.');}
 if(allowMissing&&response.status===404)return null;
 if(!response.ok){
  const permission=endpoint.startsWith('/actions/variables')?'Variables':endpoint.startsWith('/actions/workflows')?'Actions':null;
  const guidance=permission?`Check repository access and grant the GitHub token ${permission}: read and write permission.`:'Check repository access for GITHUB_REPO and GITHUB_PAT.';
  throw new DescriptionWorkflowError(`GitHub returned ${response.status}. ${guidance}`,502,response.status);
 }
 if(method!=='GET')return null;
 try{return await response.json();}catch{throw new DescriptionWorkflowError('GitHub returned an invalid workflow response.');}
}

async function workflowRuns(){
 let data;
 try{data=await githubRequest(`/actions/workflows/${DESCRIPTION_WORKFLOW}/runs?per_page=20`);}
 catch(error){
  if(error.githubStatus!==404)throw error;
  // Verify repository access before attributing GitHub's ambiguous 404 to deployment.
  const repository=await githubRequest('');
  const {repo}=configuration();
  throw new DescriptionWorkflowError(`The rewrite workflow is unavailable in ${repo}. Deploy .github/workflows/${DESCRIPTION_WORKFLOW} to the default branch (${repository.default_branch||'unknown'}) and enable GitHub Actions. If it is already deployed, check the token's Actions access.`,503,404);
 }
 if(!Array.isArray(data?.workflow_runs))throw new DescriptionWorkflowError('GitHub returned an invalid workflow run list.');
 return data.workflow_runs;
}

const runState=run=>{
 if(!run)return 'idle';
 if(run.status==='in_progress')return 'running';
 if(activeStatuses.has(run.status))return 'queued';
 if(['failure','timed_out','action_required','startup_failure'].includes(run.conclusion))return 'failed';
 if(run.conclusion==='cancelled')return 'cancelled';
 if(run.conclusion==='skipped')return 'skipped';
 return run.status==='completed'?'completed':'unavailable';
};

export async function getDescriptionRewriteWorkflow(){
 const {repo,configured}=configuration();
 const base={configured,autoRun:configured?false:null,automationAvailable:configured,automationWarning:null,status:configured?'idle':'unavailable',latestRun:null,modelId:REWRITE_MODEL.modelId,
  workflowUrl:configured?`https://github.com/${repo}/actions/workflows/${DESCRIPTION_WORKFLOW}`:null};
 if(!configured)return base;
 const [variableResult,runsResult]=await Promise.allSettled([githubRequest(`/actions/variables/${DESCRIPTION_AUTO_RUN_VARIABLE}`,{allowMissing:true}),workflowRuns()]);
 // A Variables permission error must not hide workflow status or block manual runs.
 if(runsResult.status==='rejected')throw runsResult.reason;
 const runs=runsResult.value;
 const automationAvailable=variableResult.status==='fulfilled';
 const autoRun=automationAvailable?variableResult.value?.value==='true':null;
 const run=runs.find(r=>r.status==='in_progress')||runs.find(r=>activeStatuses.has(r.status))||runs[0];
 return {...base,autoRun,automationAvailable,automationWarning:automationAvailable?null:variableResult.reason.message,status:runState(run),latestRun:run?{
  id:run.id,status:run.status,conclusion:run.conclusion,createdAt:run.created_at,updatedAt:run.updated_at,
  url:`https://github.com/${repo}/actions/runs/${run.id}`,
 }:null};
}

export async function setDescriptionRewriteAutomation(autoRun){
 const endpoint=`/actions/variables/${DESCRIPTION_AUTO_RUN_VARIABLE}`;
 const variable=await githubRequest(endpoint,{allowMissing:true});
 const body={name:DESCRIPTION_AUTO_RUN_VARIABLE,value:String(autoRun)};
 if(variable)await githubRequest(endpoint,{method:'PATCH',body});
 else{
  try{await githubRequest('/actions/variables',{method:'POST',body});}
  catch(error){if(error.githubStatus!==409)throw error;await githubRequest(endpoint,{method:'PATCH',body});}
 }
 return {autoRun};
}

export async function dispatchDescriptionRewrite(){
 const runs=await workflowRuns();
 if(runs.some(r=>activeStatuses.has(r.status)))throw new DescriptionWorkflowError('Description rewriting is already running or queued.',409);
 const repository=await githubRequest('');
 if(typeof repository?.default_branch!=='string'||!repository.default_branch)throw new DescriptionWorkflowError('The repository default branch could not be determined.');
 await githubRequest(`/actions/workflows/${DESCRIPTION_WORKFLOW}/dispatches`,{method:'POST',body:{ref:repository.default_branch}});
 return {triggeredAt:new Date().toISOString()};
}
