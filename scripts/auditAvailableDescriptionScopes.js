/** Read-only explicit-qualification audit of durable model drafts. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {auditExplicitQualificationScope} from '../rewriting/explicitQualificationScopeAudit.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';

const at=process.argv.indexOf('--run-dir');
if(at<0||!process.argv[at+1])throw new Error('Use --run-dir <dry-run root>');
const root=path.resolve(process.argv[at+1]);
const status=JSON.parse(await fs.readFile(path.join(root,'pipeline-status.json'),'utf8'));
const directory=path.join(root,status.rewriteDirectory);
const final=process.argv.includes('--final');
const baseline=JSON.parse(await fs.readFile(path.join(directory,'summary.json'),'utf8'));
if(final&&['starting','running'].includes(baseline.status))throw new Error('Full baseline is still running; use a live audit.');
const report={generatedAt:new Date().toISOString(),status:'running',partial:!final,baselineStatus:baseline.status,reviewedRows:0,modelDrafts:0,modelDraftsWithMatchedScopes:0,scopedFacts:0,ambiguousFacts:0,uncoveredFacts:0,excludedEmploymentConditions:0,flaggedDrafts:0,flaggedFacts:0,reasons:{},sources:{},examples:[]};
let stopped=false,busy=false;
const guard=async()=>{if(busy)return;busy=true;try{
 const memoryPercent=100*(1-os.freemem()/os.totalmem());
 if(memoryPercent>90){stopped=true;await fs.writeFile(path.join(root,'user-stop'),JSON.stringify({source:'explicit-scope-audit',memoryPercent,at:new Date().toISOString()})+'\n');}
 for(const name of ['memory-stop.json','user-stop'])try{await fs.access(path.join(root,name));stopped=true;}catch(e){if(e.code!=='ENOENT')throw e;}
}finally{busy=false;}};
await guard();const timer=setInterval(()=>{void guard().catch(error=>{stopped=true;report.error=error.message;});},2000);
try{
 const content=await fs.readFile(path.join(directory,'results.ndjson'),'utf8'),end=content.lastIndexOf('\n');
 report.ignoredTrailingPartialRecord=end<content.length-1?1:0;
 const rows=end<0?[]:content.slice(0,end).split('\n').filter(Boolean).map(line=>JSON.parse(line));
 report.availableDurableRows=rows.length;
 for(const row of rows){
  if(stopped)break;report.reviewedRows++;
  if(row.outputMethod!=='validated_model_plan')continue;
  const file=path.join(directory,'cases',String(row.index).padStart(6,'0')+'-'+row.key.slice(0,12)+'.json');
  const value=JSON.parse(await fs.readFile(file,'utf8')),check=auditExplicitQualificationScope(value);
  report.modelDrafts++;if(check.scopedFacts)report.modelDraftsWithMatchedScopes++;
  for(const name of ['scopedFacts','ambiguousFacts','uncoveredFacts','excludedEmploymentConditions'])report[name]+=check[name];
  if(check.findings.length){
   report.flaggedDrafts++;report.flaggedFacts+=check.findings.length;report.sources[row.source]=(report.sources[row.source]||0)+1;
   for(const finding of check.findings)report.reasons[finding.reason]=(report.reasons[finding.reason]||0)+1;
   if(report.examples.length<120)report.examples.push({file,source:row.source,title:row.title,key:row.key,findings:check.findings});
  }
 }
 report.status=stopped?'stopped':'complete';
}catch(error){report.status='error';report.error=error.message;process.exitCode=1;}
finally{
 clearInterval(timer);
 report.finishedAt=new Date().toISOString();
 report.limitation='Explicit matched employer headings only. The audit reads raw source blocks independently of stored parser scope labels. Short facts, duplicate scopes, absent headings and employment conditions have limited coverage. Findings require semantic review; these counts are not full classification accuracy.';
 await writeFileAtomically(path.join(directory,'explicit-scope-audit'+(final?'':'-live')+'.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({...report,examples:undefined}));if(stopped)process.exitCode=90;
}
