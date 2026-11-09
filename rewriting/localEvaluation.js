import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeFileAtomically} from './atomicFile.js';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {assessDescriptionRewrite,validateDescriptionRewrite} from './runner.js';

export const evaluateLocalJobs = async (jobs,{outputDir,policyIdentity,client,deadline,signal,onResult=()=>{}}) => {
 await fs.mkdir(outputDir,{recursive:true});const stats={total:0,generated:0,cached:0,accepted:0,failed:0,skipped:0,interrupted:false};
 for(const job of jobs){
  if(signal?.aborted||Date.now()>=deadline){stats.interrupted=true;break;}
  const input=buildRewriteInput(job),key=createHash('sha256').update(policyIdentity+'\n'+input.inputHash).digest('hex'),file=path.join(outputDir,key+'.json');stats.total++;
  let previous;try{previous=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous){if(previous.inputHash!==input.inputHash||previous.policyIdentity!==policyIdentity)throw new Error('Invalid local generation cache');stats.cached++;if(previous.accepted)stats.accepted++;else if(previous.generated)stats.failed++;else stats.skipped++;await onResult({...previous,cached:true,file});continue;}
  const assessment=assessDescriptionRewrite(input,client.format),started=Date.now();let response,result;
  if(!assessment.ok){result=assessment;stats.skipped++;}
  else{
   stats.generated++;
   try{response=await client.generate(input,{signal,remainingMs:deadline-Date.now()});
    if(signal?.aborted||Date.now()>=deadline){stats.interrupted=true;break;}
    result=response.finishReason==='stop'&&response.validationFailure?response.validationFailure:validateDescriptionRewrite(response.value,input,response.finishReason,response.format||client.format);
   }catch(error){if(signal?.aborted||Date.now()>=deadline){stats.interrupted=true;break;}response={rawText:error.rawText?.slice(0,2400),usage:error.usage,timings:error.timings,generations:error.generations};result={ok:false,reason:error.name==='TimeoutError'?'timeout':'generation_error'};}
   if(result.ok)stats.accepted++;else stats.failed++;
  }
  const row={policyIdentity,inputHash:input.inputHash,title:input.facts.title,company:input.facts.company,sourceWords:input.sourceWords,sourceDescription:input.sourceDescription,sourceFacts:assessment.facts,durationMs:Date.now()-started,generated:assessment.ok,modelPlanCached:response?.cachedModelPlan||false,accepted:result.ok,reason:result.reason,description:result.description,wordCount:result.wordCount,quality:result.quality,completion:response?.value,completionPreview:response?.rawText,validation:result.diagnostic,finishReason:response?.finishReason,usage:response?.usage,timings:response?.timings,generations:response?.generations,completedAt:new Date().toISOString()};
  await writeFileAtomically(file,JSON.stringify(row,null,2)+'\n');await onResult({...row,file});
 }
 return stats;
};

/** Reuse complete archives; a truncated pre-v2 archive is reconstructed from its source. */
export const archiveJobSnapshot = async (sourceFile,snapshotFile,{sourceRoot}={}) => {
 const array=text=>{const value=JSON.parse(text);if(!Array.isArray(value))throw new SyntaxError('Invalid company snapshot');return value;};
 try{return array(await fs.readFile(snapshotFile,'utf8'));}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
 const canonical=await fs.realpath(sourceFile);
 if(sourceRoot){const relative=path.relative(path.resolve(sourceRoot),canonical);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Snapshot must be inside the current backend');}
 const text=await fs.readFile(canonical,'utf8'),jobs=array(text);
 await fs.mkdir(path.dirname(snapshotFile),{recursive:true});
 await writeFileAtomically(snapshotFile,text);
 return jobs;
};
