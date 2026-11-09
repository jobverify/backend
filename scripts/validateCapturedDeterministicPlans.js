/** Validate fully fixed plans across the capture; never invokes a model or publishes. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {buildSourceFacts} from '../rewriting/factPlan.js';
import {buildDeterministicFactPlan} from '../rewriting/deterministicFactPlan.js';
import {auditExplicitQualificationScope} from '../rewriting/explicitQualificationScopeAudit.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';

const at=process.argv.indexOf('--run-dir');
if(at<0||!process.argv[at+1])throw new Error('Use --run-dir <completed capture>');
const labelAt=process.argv.indexOf('--label'),label=labelAt<0?'current':process.argv[labelAt+1];
if(!/^[a-z0-9-]+$/.test(label||''))throw new Error('Use a simple validation label containing letters, digits and hyphens.');
const root=path.resolve(process.argv[at+1]),directory=path.join(root,'deterministic-plan-validation-'+label);
try{await fs.access(directory);throw new Error('Validation directory exists; preserve it before another run.');}catch(error){if(error.code!=='ENOENT')throw error;}
const state=JSON.parse(await fs.readFile(path.join(root,'run-state.json'),'utf8'));
if(state.status!=='complete'||state.completedCount!==state.totalSources)throw new Error('Capture is not complete.');
const policy=createHash('sha256');
for(const file of ['../rewriting/factPlan.js','../src/services/jobDescriptionPolicy.js','../rewriting/deterministicFactPlan.js','../rewriting/explicitQualificationScopeAudit.js'])policy.update(await fs.readFile(new URL(file,import.meta.url)));
await fs.mkdir(path.join(directory,'cases'),{recursive:true});
const report={status:'running',pid:process.pid,startedAt:new Date().toISOString(),policyHash:policy.digest('hex'),capturedRows:0,duplicates:0,uniqueJobs:0,
 validated:0,declined:0,declineReasons:{},sourceFactLossDrafts:0,sourceFactLoss:0,draftsWithMatchedScopes:0,scopedFacts:0,ambiguousFacts:0,
 uncoveredFacts:0,excludedEmploymentConditions:0,flaggedDrafts:0,flaggedFacts:0,scopeReasons:{},peakHostMemoryPercent:0,peakProcessMiB:0,
 modelRequests:0,mongoWrites:0,examples:[],reviewSample:[]};
const seen=new Set(),sampleGroups=new Map();let stopped=false,busy=false,lines=[];
const guard=async()=>{
 if(busy)return;busy=true;
 try{
  const memoryPercent=100*(1-os.freemem()/os.totalmem());
  report.peakHostMemoryPercent=Math.max(report.peakHostMemoryPercent,memoryPercent);
  report.peakProcessMiB=Math.max(report.peakProcessMiB,process.memoryUsage().rss/1048576);
  if(memoryPercent>90){stopped=true;report.stopReason='resource_limit';await fs.writeFile(path.join(root,'user-stop'),JSON.stringify({source:'deterministic-validation',at:new Date().toISOString(),memoryPercent})+'\n');}
  for(const file of ['memory-stop.json','user-stop'])try{await fs.access(path.join(root,file));stopped=true;report.stopReason??='shared_stop';}catch(error){if(error.code!=='ENOENT')throw error;}
 }finally{busy=false;}
};
const checkpoint=()=>writeFileAtomically(path.join(directory,'summary.json'),JSON.stringify(report,null,2)+'\n');
const flush=async()=>{if(lines.length){await fs.appendFile(path.join(directory,'results.ndjson'),lines.join('\n')+'\n');lines=[];}};
await guard();await checkpoint();
const timer=setInterval(()=>{void guard().catch(error=>{stopped=true;report.error=error.message;report.stopReason='monitor_error';});},2000);
try{
 for(const filename of (await fs.readdir(path.join(root,'snapshots'))).filter(file=>file.endsWith('.json')).sort()){
  if(stopped)break;
  const source=filename.slice(0,-5),jobs=JSON.parse(await fs.readFile(path.join(root,'snapshots',filename),'utf8'));
  for(const job of jobs){
   if(stopped)break;report.capturedRows++;
   const input=buildRewriteInput(job),key=createHash('sha256').update(source+'|'+(job.sourceUrl||job.applyUrl||job.link||job.jobId||job.title)+'|'+input.inputHash).digest('hex');
   if(seen.has(key)){report.duplicates++;continue;}seen.add(key);report.uniqueJobs++;
   const draft=buildDeterministicFactPlan(input,{preserveContext:true});
   if(!draft.ok){report.declined++;report.declineReasons[draft.reason]=(report.declineReasons[draft.reason]||0)+1;}
   else{
    report.validated++;
    const facts=buildSourceFacts(input,{preserveContext:true}),lost=facts.filter(f=>!draft.description.includes(f.text));
    if(lost.length){report.sourceFactLossDrafts++;report.sourceFactLoss+=lost.length;}
    const value={key,source,title:job.title,url:job.sourceUrl||job.applyUrl||job.link,sourceWords:input.sourceWords,outputMethod:'validated_deterministic_plan',
      originalDescription:input.sourceDescription,description:draft.description,sourceSectionFacts:facts,compactPlan:draft.compactPlan,quality:draft.quality};
    const check=auditExplicitQualificationScope(value),caseFile=path.join(directory,'cases',key.slice(0,16)+'.json');
    await writeFileAtomically(caseFile,JSON.stringify({...value,sourceFactLoss:lost.map(f=>f.text),scopeAudit:check},null,2)+'\n');
    if(check.scopedFacts)report.draftsWithMatchedScopes++;
    for(const name of ['scopedFacts','ambiguousFacts','uncoveredFacts','excludedEmploymentConditions'])report[name]+=check[name];
    if(check.findings.length){report.flaggedDrafts++;report.flaggedFacts+=check.findings.length;for(const finding of check.findings)report.scopeReasons[finding.reason]=(report.scopeReasons[finding.reason]||0)+1;
      if(report.examples.length<80)report.examples.push({caseFile,source,title:job.title,findings:check.findings});}
    const wordBucket=input.sourceWords<250?'under250':input.sourceWords<500?'250to499':input.sourceWords<1000?'500to999':'1000plus';
    const group=wordBucket+'|'+(check.findings.length?'flagged':'unflagged'),n=sampleGroups.get(group)||0;
    if(n<3){report.reviewSample.push({caseFile,source,title:job.title,words:input.sourceWords,group});sampleGroups.set(group,n+1);}
    lines.push(JSON.stringify({key,source,title:job.title,caseFile,sourceWords:input.sourceWords,sourceFactLoss:lost.length,scopeAudit:check}));
   }
   if(report.uniqueJobs%25===0)await delay(5);
   if(lines.length>=100)await flush();
   if(report.uniqueJobs%2500===0){await flush();await checkpoint();console.log(JSON.stringify({event:'validation-progress',uniqueJobs:report.uniqueJobs,validated:report.validated,flaggedDrafts:report.flaggedDrafts,peakHostMemoryPercent:report.peakHostMemoryPercent}));}
  }
 }
 await guard();report.status=stopped?'stopped':'complete';
}catch(error){report.status='error';report.error=error.message;process.exitCode=1;}
finally{
 clearInterval(timer);await flush();report.finishedAt=new Date().toISOString();report.wallSeconds=(Date.parse(report.finishedAt)-Date.parse(report.startedAt))/1000;
 report.limitation='Fully fixed plans only; declined inputs remain pending for model or source formatting. Scope flags come from explicit matched raw employer blocks and require semantic review. Full fact inclusion does not prove classification accuracy or source completeness. Concurrent shared Windows host; not an isolated hybrid speed test or a GitHub Actions benchmark. No baseline snapshots or production descriptions changed.';
 await checkpoint();console.log(JSON.stringify({...report,examples:undefined,reviewSample:undefined}));if(stopped)process.exitCode=90;
}
