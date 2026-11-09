/** Read-only employer-page recovery probe, using the existing scraper parser. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {enrichJobWithPublicExperience} from '../scraper-support/utils/publicExperienceEnrichment.js';
import {publicSourceCandidate} from '../rewriting/publicSourceCandidate.js';
import {publicPostingDescription} from '../rewriting/publicPostingDescription.js';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {writeFileAtomically} from '../rewriting/atomicFile.js';

const at=process.argv.indexOf('--run-dir');if(at<0||!process.argv[at+1])throw new Error('Use --run-dir <experiment directory>');
const root=path.resolve(process.argv[at+1]),directory=path.join(root,'source-recovery');
const full=process.argv.includes('--all-missing');
const inputs=[];
if(full){
 for(const filename of (await fs.readdir(path.join(root,'snapshots'))).filter(f=>f.endsWith('.json')).sort()){
  const jobs=JSON.parse(await fs.readFile(path.join(root,'snapshots',filename),'utf8'));
  for(const job of jobs)if(!buildRewriteInput(job).sourceDescription.trim())inputs.push({source:filename.slice(0,-5),job});
 }
}else inputs.push(...JSON.parse(await fs.readFile(path.join(directory,'probe-inputs.json'),'utf8')));
const outputFile=path.join(directory,full?'full-results.ndjson':'probe-results.json');
if(full){try{await fs.access(outputFile);throw new Error('Full recovery output already exists; inspect it before starting another pass.');}catch(error){if(error.code!=='ENOENT')throw error;}}
const controller=new AbortController();let guardBusy=false,stopReading;
const guard=async()=>{if(guardBusy||controller.signal.aborted)return;guardBusy=true;try{
 const reading={at:new Date().toISOString(),memoryPercent:100*(1-os.freemem()/os.totalmem())};
 if(reading.memoryPercent>90){stopReading=reading;controller.abort(new Error('resource_limit'));await fs.writeFile(path.join(root,'user-stop'),'resource_limit in source recovery '+JSON.stringify(reading)+'\n');}
 for(const file of ['memory-stop.json','user-stop']){try{await fs.access(path.join(root,file));controller.abort(new Error('shared_stop'));}catch(error){if(error.code!=='ENOENT')throw error;}}
}catch(error){controller.abort(error);}finally{guardBusy=false;}};
await guard();const timer=setInterval(()=>{void guard();},2000);
const results=[],queue=[...inputs];let writeTail=Promise.resolve();
const startedAt=new Date().toISOString();
if(full)await writeFileAtomically(path.join(directory,'full-progress.json'),JSON.stringify({pid:process.pid,startedAt,completed:0,total:inputs.length,concurrency:10})+'\n');
try{await Promise.all(Array.from({length:Math.min(10,queue.length)},async()=>{
 while(queue.length&&!controller.signal.aborted){const {source,job}=queue.shift(),started=Date.now();let enriched,error;
  try{enriched=await enrichJobWithPublicExperience(job,{fetchTimeoutMs:15000,signal:controller.signal});}catch(e){error=e.message;}
  let candidate=publicSourceCandidate(job,enriched),evidence={method:'existing_public_page_parser'};
  if(candidate.kind!=='candidate'&&!controller.signal.aborted){
   try{
    const url=job.sourceUrl||job.applyUrl||job.link;
    const response=await fetch(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]),headers:{Accept:'text/html'}});
    if(response.ok){const html=await response.text(),posting=publicPostingDescription(job,html,response.url);
     if(posting){candidate=publicSourceCandidate(job,{...job,jobDescription:posting.description});evidence=posting.evidence;}
    }
   }catch(e){error=error||e.message;}
  }
  const input=candidate.input;
  const row={source,title:job.title,url:job.sourceUrl||job.applyUrl||job.link,durationMs:Date.now()-started,sourceWords:input?.sourceWords||0,recovered:candidate.kind==='candidate',candidateKind:candidate.kind,requiresEmployerPageReview:!!candidate.requiresEmployerPageReview,evidence,publicExperienceChecked:enriched?.publicExperienceChecked,error,originalJob:job,recoveredJob:enriched,descriptionCandidate:candidate.job};
  results.push(row);
  if(full){writeTail=writeTail.then(()=>fs.appendFile(outputFile,JSON.stringify(row)+'\n'));await writeTail;if(results.length%25===0)await writeFileAtomically(path.join(directory,'full-progress.json'),JSON.stringify({pid:process.pid,startedAt,at:new Date().toISOString(),completed:results.length,total:inputs.length,candidates:results.filter(r=>r.recovered).length,stopped:controller.signal.aborted})+'\n');}
  else await writeFileAtomically(outputFile,JSON.stringify({completed:results.length,total:inputs.length,results},null,2)+'\n');
  console.log(JSON.stringify({source,title:job.title,recovered:row.recovered,sourceWords:row.sourceWords,seconds:row.durationMs/1000}));
 }
}));}finally{clearInterval(timer);}
const summary={pid:process.pid,startedAt,finishedAt:new Date().toISOString(),completed:results.length,total:inputs.length,recoveredCandidates:results.filter(r=>r.recovered).length,listingExcerpts:results.filter(r=>r.candidateKind==='listing_excerpt').length,stopped:controller.signal.aborted,stopReading,
 limitation:'Candidates require employer-page review for completeness and identity. They do not modify the frozen primary benchmark inputs.'};
await writeFileAtomically(path.join(directory,full?'full-summary.json':'probe-summary.json'),JSON.stringify(summary,null,2)+'\n');
// Shared scraper modules can retain idle pools after all results are durable.
await new Promise(resolve=>process.stdout.write(JSON.stringify(summary)+'\n',resolve));
process.exit(controller.signal.aborted?90:0);
