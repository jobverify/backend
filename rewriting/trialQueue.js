import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {TRIAL_POLICY,prepareTrialInput,validateTrialRephrase} from './trialRephrase.js';
import {writeFileAtomically} from './atomicFile.js';
/** Sequential local-only evaluation. Interrupted jobs have no terminal case/checkpoint. */
export const evaluateTrialJobs=async(jobs,{source,caseDir,client,signal,onResult=()=>{},startIndex=0,maxJobs=Infinity,policyIdentity=TRIAL_POLICY}={})=>{
 await fs.mkdir(caseDir,{recursive:true});
 const endIndex=Math.min(jobs.length,startIndex+maxJobs);
 for(let i=startIndex;i<endIndex;i++){
  if(signal?.aborted)return {interrupted:true,nextIndex:i};
  const job=jobs[i],input=buildRewriteInput(job);
  const key=createHash('sha256').update(JSON.stringify([policyIdentity,source,job.applyUrl||job.link||job.sourceUrl||'',input.inputHash])).digest('hex');const file=path.join(caseDir,key+'.json');
  let row;try{row=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(row?.policyIdentity===policyIdentity&&row.inputHash===input.inputHash){await onResult({...row,file,cached:true,index:i});continue;}
  const started=Date.now(),assessment=prepareTrialInput(input);let completion,result;
  try{if(assessment.ok){completion=await client.generate(input,{signal});if(signal?.aborted)return {interrupted:true,nextIndex:i};result=validateTrialRephrase(completion.value,input,completion.finishReason);}else result=assessment;
  }catch(error){if(signal?.aborted)return {interrupted:true,nextIndex:i};result={ok:false,reason:error.name==='TimeoutError'?'generation_timeout':'generation_error',error:error.message};}
  if(signal?.aborted)return {interrupted:true,nextIndex:i};
  row={policyIdentity,source,inputHash:input.inputHash,title:input.facts.title,company:input.facts.company,applyUrl:job.applyUrl||job.link||job.sourceUrl||null,sourceDescription:input.sourceDescription,sourceFacts:assessment.facts,status:result.ok?'draft_passed_checks':'source_retained',reason:result.ok?null:result.reason,attempted:assessment.ok,generated:typeof completion?.value?.overview==='string',description:result.ok?result.description:input.sourceDescription,descriptionFormat:result.ok?'markdown':'plain',completion,quality:result.quality||null,durationMs:Date.now()-started,completedAt:new Date().toISOString(),mongoWrites:0,publicationStatus:'unpublished'};
  await writeFileAtomically(file,JSON.stringify(row,null,2)+'\n');await onResult({...row,file,index:i});
 }
 return {interrupted:false,nextIndex:endIndex};
};
