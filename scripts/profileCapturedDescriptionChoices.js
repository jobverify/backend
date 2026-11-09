/** Read-only full-capture analysis of decisions remaining in the opt-in fact plan. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {assessRewriteInput,factPlanSchema} from '../rewriting/factPlan.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';

const at=process.argv.indexOf('--run-dir');
if(at<0||!process.argv[at+1])throw new Error('Use --run-dir <completed capture>');
const labelAt=process.argv.indexOf('--label'),label=labelAt<0?'current':process.argv[labelAt+1];
if(!/^[a-z0-9-]+$/i.test(label))throw new Error('Invalid profile label');
const root=path.resolve(process.argv[at+1]),output=path.join(root,'description-choice-profile-'+label+'.json');
try{await fs.access(output);throw new Error('Profile exists; choose a distinct label to preserve it.');}catch(error){if(error.code!=='ENOENT')throw error;}
const state=JSON.parse(await fs.readFile(path.join(root,'run-state.json'),'utf8'));
if(state.status!=='complete'||state.completedCount!==state.totalSources)throw new Error('Capture is not complete.');
const policy=createHash('sha256');
for(const file of ['../rewriting/factPlan.js','../src/services/jobDescriptionPolicy.js'])policy.update(await fs.readFile(new URL(file,import.meta.url)));
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),policyHash:policy.digest('hex'),preserveContext:true,
 capturedRows:0,duplicates:0,uniqueJobs:0,emptyRawSource:0,eligible:0,ineligible:0,assessmentReasons:{},strictlyDeterminedEligible:0,
 overviewOnlyEligible:0,needsCategoryChoiceEligible:0,unknownFactBins:{zero:0,one:0,twoToFour:0,fivePlus:0},maxUnknownFacts:0,
 wordBuckets:{},sources:{},examples:{strict:[],overview:[],categories:[]},peakHostMemoryPercent:0,peakProcessMiB:0,mongoWrites:0,modelRequests:0};
const seen=new Set();let stopped=false,busy=false;
const guard=async()=>{
 if(busy)return;busy=true;
 try{
  const memoryPercent=100*(1-os.freemem()/os.totalmem());
  report.peakHostMemoryPercent=Math.max(report.peakHostMemoryPercent,memoryPercent);
  report.peakProcessMiB=Math.max(report.peakProcessMiB,process.memoryUsage().rss/1048576);
  if(memoryPercent>90){stopped=true;report.stopReason='resource_limit';await fs.writeFile(path.join(root,'user-stop'),JSON.stringify({source:'description-choice-profile',at:new Date().toISOString(),memoryPercent})+'\n');}
  for(const file of ['memory-stop.json','user-stop'])try{await fs.access(path.join(root,file));stopped=true;report.stopReason??='shared_stop';}catch(error){if(error.code!=='ENOENT')throw error;}
 }finally{busy=false;}
};
await guard();
const timer=setInterval(()=>{void guard().catch(error=>{stopped=true;report.error=error.message;report.stopReason='monitor_error';});},2000);
const checkpoint=()=>writeFileAtomically(output,JSON.stringify(report,null,2)+'\n');
await checkpoint();
try{
 for(const file of (await fs.readdir(path.join(root,'snapshots'))).filter(file=>file.endsWith('.json')).sort()){
  if(stopped)break;
  const source=file.slice(0,-5),jobs=JSON.parse(await fs.readFile(path.join(root,'snapshots',file),'utf8'));
  for(const job of jobs){
   if(stopped)break;report.capturedRows++;
   const input=buildRewriteInput(job);
   const key=createHash('sha256').update(source+'|'+(job.sourceUrl||job.applyUrl||job.link||job.jobId||job.title)+'|'+input.inputHash).digest('hex');
   if(seen.has(key)){report.duplicates++;continue;}seen.add(key);report.uniqueJobs++;
   if(!input.sourceDescription.trim()){report.emptyRawSource++;continue;}
   const assessment=assessRewriteInput(input,{preserveContext:true});
   if(!assessment.ok){report.ineligible++;report.assessmentReasons[assessment.reason]=(report.assessmentReasons[assessment.reason]||0)+1;continue;}
   report.eligible++;
   const schema=factPlanSchema(input,{preserveContext:true}),unknown=schema.properties.categories.minItems,overviews=schema.properties.overviewFactId.enum?.length||0;
   const kind=unknown?'categories':overviews>1?'overview':'strict';
   const counter={strict:'strictlyDeterminedEligible',overview:'overviewOnlyEligible',categories:'needsCategoryChoiceEligible'}[kind];
   report[counter]++;report.maxUnknownFacts=Math.max(report.maxUnknownFacts,unknown);
   report.unknownFactBins[unknown===0?'zero':unknown===1?'one':unknown<5?'twoToFour':'fivePlus']++;
   const words=input.sourceWords<250?'under250':input.sourceWords<500?'250to499':input.sourceWords<1000?'500to999':'1000plus';
   const group=report.wordBuckets[words]??={eligible:0,strict:0,overview:0,categories:0};group.eligible++;group[kind]++;
   const bySource=report.sources[source]??={eligible:0,strict:0,overview:0,categories:0};bySource.eligible++;bySource[kind]++;
   if(report.examples[kind].length<3)report.examples[kind].push({key,source,title:job.title,words:input.sourceWords,unknownFacts:unknown,overviewChoices:overviews});
   if(report.uniqueJobs%25===0)await delay(5);
   if(report.uniqueJobs%2500===0){await checkpoint();console.log(JSON.stringify({event:'profile-progress',uniqueJobs:report.uniqueJobs,eligible:report.eligible,strict:report.strictlyDeterminedEligible,peakHostMemoryPercent:report.peakHostMemoryPercent}));}
  }
 }
 await guard();report.status=stopped?'stopped':'complete';
}catch(error){report.status='error';report.error=error.message;process.exitCode=1;}
finally{
 clearInterval(timer);report.finishedAt=new Date().toISOString();report.wallSeconds=(Date.parse(report.finishedAt)-Date.parse(report.startedAt))/1000;
 report.limitation='Current opt-in parser, not the frozen running baseline. Empty raw fields are counted separately from nonempty HTML or heading-only fields without usable text. Eligible inputs with no unknown categories and at most one overview option have no model decision to make. Counts are a possible optimization, not measured hybrid speed, revised-model quality, or a GitHub Actions benchmark. No descriptions are changed.';
 await checkpoint();console.log(JSON.stringify({...report,sources:undefined,examples:undefined}));if(stopped)process.exitCode=90;
}
