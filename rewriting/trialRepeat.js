import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeFileAtomically} from './atomicFile.js';

const finalStatuses=new Set(['complete','scrape_failed']);
const hash=text=>createHash('sha256').update(text).digest('hex');
const words=text=>String(text||'').toLowerCase().match(/[a-z0-9]+/g)||[];
const saveJson=(file,value)=>writeFileAtomically(file,JSON.stringify(value,null,2)+'\n');

/** A completed scraper alone is insufficient: all rewrite cursors and owned processes must finish. */
export function repeatDecision({state,report,checkpoint,terminal,analysis,ownerAlive,workerAlive}) {
 if(['safety_stopped','error','stopped'].includes(state.status))return {action:'stop',reason:state.status};
 if(!report)return {action:'wait',reason:'waiting_for_trial'};
 if(['resource_stopped','monitor_error'].includes(report.status))return {action:'stop',reason:report.status};
 if(report.mongoWrites!==0||report.policyIdentity!==state.expectedPolicy)return {action:'stop',reason:'trial_contract_changed'};
 if(state.second)return {action:'wait',reason:'second_already_claimed'};
 if(!finalStatuses.has(report.status)||!report.finishedAt||terminal?.finishedAt!==report.finishedAt||terminal?.status!==report.status||terminal?.mongoWrites!==0)return {action:'wait',reason:'waiting_for_final_state'};
 if(checkpoint?.mode!=='dry-run'||checkpoint.totalSources!==report.summary.totalSources)return {action:'stop',reason:'invalid_dry_checkpoint'};
 if(checkpoint.completedCount!==checkpoint.totalSources||Object.values(report.captures||{}).some(c=>!c.finished||c.cursor!==c.jobs))return {action:'wait',reason:'waiting_for_full_drain'};
 if(ownerAlive||workerAlive)return {action:'wait',reason:'waiting_for_owned_cleanup'};
 if(!analysis||analysis.status!=='complete'||analysis.finishedAt!==report.finishedAt||analysis.policyIdentity!==report.policyIdentity)return {action:'analyze'};
 return {action:'launch'};
}

/** Commit before spawning. An uncertain/crashed launch is never automatically duplicated. */
export async function claimRepeatLaunch(state,file,runDir) {
 if(state.second||['safety_stopped','error','stopped'].includes(state.status))throw new Error('Second trial cannot be claimed again');
 state.second={runDir,outputName:'rewrites-v4',claimedAt:new Date().toISOString()};
 state.status='launching_second';
 await saveJson(file,state);
}

const median=values=>{
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
};
function nearCopied(overview,source){
 const output=words(overview.replace(/^you will\s+/i,'')),input=words(source);
 if(output.length<6)return false;
 const grams=new Set();for(let i=0;i<=input.length-6;i++)grams.add(input.slice(i,i+6).join(' '));
 let matches=0;for(let i=0;i<=output.length-6;i++)if(grams.has(output.slice(i,i+6).join(' ')))matches++;
 return matches/(output.length-5)>=0.8;
}
const fence=text=>'~~~~~\n'+String(text||'').replace(/~~~~~/g,'~ ~ ~ ~ ~')+'\n~~~~~';

/** Full-cohort automated analysis, explicitly distinct from a human publication review. */
export async function analyzeCompletedTrial({runDir,outputName,report,checkpoint,signal}) {
 if(!finalStatuses.has(report.status)||!report.finishedAt||report.mongoWrites!==0||checkpoint?.mode!=='dry-run'||checkpoint.completedCount!==checkpoint.totalSources)throw new Error('Analysis requires a drained full dry trial');
 if(Object.values(report.captures||{}).some(c=>!c.finished||c.cursor!==c.jobs))throw new Error('Rewrite queue is not drained');
 const directory=path.join(runDir,'analysis');await fs.mkdir(directory,{recursive:true});
 await fs.rm(path.join(directory,'complete.json'),{force:true});
 const counts={jobsReviewed:0,generationAttempts:0,generated:0,draftsPassedChecks:0,sourceRetained:0};
 const reasons={},flags={nearCopiedOverview:0,embeddedHeading:0},durations=[],companies={},jobs=[],samples=[];
 const sampled=new Set();
 for(const name of Object.keys(report.cases||{})){
  signal?.throwIfAborted();
  if(path.basename(name)!==name||!name.endsWith('.json'))throw new Error('Invalid trial case filename');
  const file=path.join(runDir,outputName,'cases',name),row=JSON.parse(await fs.readFile(file,'utf8'));
  if(row.mongoWrites!==0||row.publicationStatus!=='unpublished'||!['draft_passed_checks','source_retained'].includes(row.status))throw new Error('Trial case is not an unpublished dry result');
  counts.jobsReviewed++;if(row.attempted){counts.generationAttempts++;if(Number.isFinite(row.durationMs))durations.push(row.durationMs);}
  if(row.generated)counts.generated++;
  const passed=row.status==='draft_passed_checks';if(passed)counts.draftsPassedChecks++;else{counts.sourceRetained++;reasons[row.reason||'unknown']=(reasons[row.reason||'unknown']||0)+1;}
  const overview=row.completion?.value?.overview||'';
  const rowFlags=[];
  if(passed&&nearCopied(overview,row.sourceDescription)){flags.nearCopiedOverview++;rowFlags.push('near_copied_overview');}
  if(passed&&(row.sourceFacts||[]).some(f=>f.section!==null&&f.text.length<90&&/^(core requirements|what we (?:can )?offer|diversity (?:&|and) inclusion|benefits|be aware of recruitment scams)$/i.test(f.text.trim()))){flags.embeddedHeading++;rowFlags.push('embedded_heading_requires_section_review');}
  const company=companies[row.source]||={jobsReviewed:0,draftsPassedChecks:0,sourceRetained:0};company.jobsReviewed++;company[passed?'draftsPassedChecks':'sourceRetained']++;
  jobs.push({key:hash(JSON.stringify([row.source,row.applyUrl||row.inputHash])),inputHash:row.inputHash,status:row.status,overviewHash:overview?hash(overview):null,file,flags:rowFlags});
  const sampleKey=row.source+':'+row.status;
  if(samples.length<30&&!sampled.has(sampleKey)){samples.push({...row,file,flags:rowFlags});sampled.add(sampleKey);}
 }
 for(const key of Object.keys(counts))if(counts[key]!==report.summary[key])throw new Error('Trial case count mismatch: '+key);
 signal?.throwIfAborted();
 let priorManualReview=null;try{await fs.access(path.join(runDir,'manual-review-first20.json'));priorManualReview=path.join(runDir,'manual-review-first20.json');}catch(error){if(error.code!=='ENOENT')throw error;}
 const analysis={status:'complete',finishedAt:report.finishedAt,policyIdentity:report.policyIdentity,analyzedAt:new Date().toISOString(),method:'automated_all_cases_with_manual_review_bundle',mongoWrites:0,publicationStatus:'unpublished',counts,reasons,flags,companies,
  scrape:{completedSources:checkpoint.completedCount,totalSources:checkpoint.totalSources,failures:Object.values(checkpoint.completed||{}).filter(c=>!c.result?.success).length},
  captures:{count:Object.keys(report.captures||{}).length,rawJobRows:Object.values(report.captures||{}).reduce((n,c)=>n+(c.rawJobs||0),0)},
  timing:{medianAttemptMs:median(durations),totalAttemptMs:durations.reduce((n,d)=>n+d,0),attemptsMeasured:durations.length},resources:report.resources||null,
  manualReview:{complete:false,priorSampleReview:priorManualReview,bundle:path.join(directory,'review-samples.md'),sampleCases:samples.length},jobs,
  limitations:['Automated flags do not prove semantic accuracy or publishability.','The model rewrites a short overview; detailed source facts are largely preserved verbatim.','Raw job rows can include duplicate capture/retry rows.','Local CPU measurements are not GitHub Actions runner benchmarks.']};
 const reportText=[ '# Complete dry trial analysis','',
  'This is an automated full-cohort report. Full manual publication review remains pending; the review bundle and any earlier manual sample review are separate evidence. All outputs remain unpublished and MongoDB writes are zero.','',
  'Sources attempted: '+analysis.scrape.completedSources+'/'+analysis.scrape.totalSources+'; failed sources: '+analysis.scrape.failures+'.',
  'Unique cases reviewed: '+counts.jobsReviewed+'; LLM attempts: '+counts.generationAttempts+'; completed model outputs: '+counts.generated+'.',
  'Passed draft checks: '+counts.draftsPassedChecks+'; complete source retained: '+counts.sourceRetained+'.',
  'Near-copied overviews flagged: '+flags.nearCopiedOverview+'; embedded heading flags: '+flags.embeddedHeading+'.',
  'Median attempted-request time: '+(analysis.timing.medianAttemptMs??'n/a')+' ms. This includes startup/error time where applicable.','',
  '## Retention reasons','',...Object.entries(reasons).map(([reason,count])=>'- '+reason+': '+count),'',
  '## Limits','',...analysis.limitations.map(text=>'- '+text),'',
  'Paired source/draft samples: review-samples.md. Complete machine-readable metrics and case index: report.json.',''];
 const sampleText=['# Source and draft review bundle','','Selected sequentially across source companies and result statuses; this is a review aid, not a manual review result.',''];
 for(const row of samples)sampleText.push('## '+String(row.source)+' — '+String(row.title),'','Result: '+row.status+'; reason: '+(row.reason||'none')+'; flags: '+(row.flags.join(', ')||'none'),'', 'Original source',fence(row.sourceDescription),'','Generated overview',fence(row.completion?.value?.overview),'','Complete candidate description',fence(row.description),'','Case: '+row.file,'');
 await writeFileAtomically(path.join(directory,'review-samples.md'),sampleText.join('\n'));
 await writeFileAtomically(path.join(directory,'report.md'),reportText.join('\n'));
 await saveJson(path.join(directory,'report.json'),analysis);
 signal?.throwIfAborted();
 await saveJson(path.join(directory,'complete.json'),{status:'complete',finishedAt:report.finishedAt,policyIdentity:report.policyIdentity,analyzedAt:analysis.analyzedAt,report:path.join(directory,'report.json'),method:analysis.method,manualReviewComplete:false});
 return analysis;
}

export function compareTrialAnalyses(first,second) {
 const before=new Map(first.jobs.map(j=>[j.key,j])),after=new Map(second.jobs.map(j=>[j.key,j]));
 const comparison={unchangedInputs:0,changedInputs:0,addedJobs:0,missingJobs:0,unchangedStatus:0,identicalOverview:0};
 for(const [key,row]of after){const prior=before.get(key);if(!prior){comparison.addedJobs++;continue;}
  if(prior.inputHash!==row.inputHash){comparison.changedInputs++;continue;}
  comparison.unchangedInputs++;if(prior.status===row.status)comparison.unchangedStatus++;
  if(prior.overviewHash&&row.overviewHash===prior.overviewHash)comparison.identicalOverview++;
 }
 for(const key of before.keys())if(!after.has(key))comparison.missingJobs++;
 return comparison;
}
