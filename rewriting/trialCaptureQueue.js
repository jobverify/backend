import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {setTimeout as delay} from 'node:timers/promises';
import {normalizeScrapedJob} from '../scraper-support/utils/normalizeScrapedJob.js';
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js';
import {writeFileAtomically} from './atomicFile.js';import {evaluateTrialJobs} from './trialQueue.js';
export const discoverTrialCaptures=async(directory,catalog)=>{
 let sources;try{sources=await fs.readdir(directory,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return [];throw error;}
 const allowed=new Set(catalog.map(c=>c.source));const records=[];
 for(const source of sources){if(!source.isDirectory()||!allowed.has(source.name)||!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(source.name))continue;
  for(const file of await fs.readdir(path.join(directory,source.name)))if(file.endsWith('.jobs.json'))records.push({source:source.name,file:path.join(directory,source.name,file),key:source.name+'/'+file});
 }
 return records.sort((a,b)=>path.basename(a.file).localeCompare(path.basename(b.file))||a.source.localeCompare(b.source));
};
export const runTrialCaptureQueue=async({runDir,outputDir,catalog,report,client,signal,isScrapeSettled,save,policyIdentity,pollMs=2000,evaluate=evaluateTrialJobs})=>{
 await fs.mkdir(path.join(outputDir,'snapshots'),{recursive:true});await fs.mkdir(path.join(outputDir,'cases'),{recursive:true});
 while(!signal?.aborted){
  const captures=await discoverTrialCaptures(path.join(runDir,'raw-captures'),catalog);let progressed=false;
  for(const capture of captures){if(signal?.aborted)break;if(report.captures[capture.key]?.finished)continue;
   const snapshot=path.join(outputDir,'snapshots',createHash('sha256').update(capture.key).digest('hex')+'.json');let jobs;
   try{jobs=JSON.parse(await fs.readFile(snapshot,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;
    const raw=JSON.parse(await fs.readFile(capture.file,'utf8'));if(raw.source!==capture.source||raw.type!=='capture'||!Array.isArray(raw.jobs)||!Number.isFinite(Date.parse(raw.capturedAt)))throw new Error('Invalid raw capture');
    const filtered=analyzePublishableJobs(raw.jobs,{now:new Date(raw.capturedAt)});jobs=filtered.eligibleJobs.map(job=>normalizeScrapedJob(job,{source:capture.source}));
    await writeFileAtomically(snapshot,JSON.stringify(jobs)+'\n');report.captures[capture.key]={source:capture.source,capturedAt:raw.capturedAt,rawJobs:raw.jobs.length,filterCounts:filtered.filterCounts,jobs:jobs.length,cursor:0,finished:false,snapshot};await save();
   }
   if(!report.captures[capture.key]){const raw=JSON.parse(await fs.readFile(capture.file,'utf8'));if(raw.source!==capture.source||!Array.isArray(raw.jobs))throw new Error('Invalid orphaned snapshot source');const filtered=analyzePublishableJobs(raw.jobs,{now:new Date(raw.capturedAt)});report.captures[capture.key]={source:capture.source,capturedAt:raw.capturedAt,rawJobs:raw.jobs.length,filterCounts:filtered.filterCounts,jobs:jobs.length,cursor:0,finished:false,snapshot};await save();}
   const record=report.captures[capture.key];
   const result=await evaluate(jobs,{source:capture.source,caseDir:path.join(outputDir,'cases'),client,signal,startIndex:record.cursor,maxJobs:1,policyIdentity,onResult:async row=>{
    const key=path.basename(row.file);if(!report.cases[key]){report.cases[key]={source:row.source,title:row.title,status:row.status,attempted:row.attempted,generated:row.generated,reason:row.reason,durationMs:row.durationMs,file:row.file};report.summary.jobsReviewed++;if(row.attempted)report.summary.generationAttempts=(report.summary.generationAttempts||0)+1;if(row.generated)report.summary.generated++;if(row.status==='draft_passed_checks')report.summary.draftsPassedChecks++;else report.summary.sourceRetained++;}
    record.cursor=row.index+1;record.finished=record.cursor===jobs.length;await save();console.log(JSON.stringify({source:row.source,title:row.title,status:row.status,reason:row.reason,durationMs:row.durationMs,cached:row.cached||false}));
   }});
   record.cursor=result.nextIndex;record.finished=!result.interrupted&&record.cursor===jobs.length;progressed=true;await save();if(result.interrupted)break;
  }
  if(signal?.aborted)break;
  // A settled scraper has closed its writer, so the final scan sees every complete capture.
  if(isScrapeSettled()&&captures.every(c=>report.captures[c.key]?.finished)){const finalCaptures=await discoverTrialCaptures(path.join(runDir,'raw-captures'),catalog);if(finalCaptures.every(c=>report.captures[c.key]?.finished))return {drained:true};}
  if(!progressed)await delay(pollMs,undefined,{signal});
 }
 return {drained:false};
};
