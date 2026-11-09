import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writeFileAtomically} from './atomicFile.js';
import {repeatDecision,claimRepeatLaunch,analyzeCompletedTrial,compareTrialAnalyses} from './trialRepeat.js';

const save=(file,state)=>writeFileAtomically(file,JSON.stringify({...state,updatedAt:new Date().toISOString()},null,2)+'\n');
export const createRepeatState=({firstRun,outputName,report})=>({
 version:1,status:'waiting_first',createdAt:new Date().toISOString(),mode:'dry-run',mongoWrites:0,
 expectedPolicy:report.policyIdentity,modelThreads:report.settings?.modelThreads||4,
 first:{runDir:path.resolve(firstRun),outputName},second:null,
 plannedSecondRun:path.join(path.dirname(path.resolve(firstRun)),'catalog-rephrase-repeat2-'+randomUUID()),
 totalTrials:2,manualReviewComplete:false,
});

/** Process a single durable transition. Only the model/scraper spawn boundary is injectable. */
export async function advanceRepeat({state,stateFile,snapshot,launch,signal}) {
 if(['complete','safety_stopped','error','stopped'].includes(state.status))return {action:'done'};
 if(!snapshot)return {action:'wait',reason:'waiting_for_trial_files'};
 const secondStage=Boolean(state.second);
 // A saved claim is sufficient to suppress another spawn, even if the controller crashed before recording its PID.
 if(secondStage&&state.status==='launching_second')return {action:'wait',reason:'launch_already_claimed'};
 const decision=repeatDecision({...snapshot,state:{...state,second:null}});
 state.waitReason=decision.reason||null;
 if(decision.action==='stop'){
  state.status=['resource_stopped','monitor_error'].includes(decision.reason)?'safety_stopped':'stopped';
  state.stop={reason:decision.reason,at:new Date().toISOString()};await save(stateFile,state);return decision;
 }
 if(decision.action==='wait'){await save(stateFile,state);return decision;}
 const current=secondStage?state.second:state.first;
 if(decision.action==='analyze'){
  state.status=secondStage?'analyzing_second':'analyzing_first';await save(stateFile,state);
  await analyzeCompletedTrial({runDir:current.runDir,outputName:current.outputName,report:snapshot.report,checkpoint:snapshot.checkpoint,signal});
 }
 signal?.throwIfAborted();
 if(secondStage){
  const first=JSON.parse(await fs.readFile(path.join(state.first.runDir,'analysis','report.json'),'utf8'));
  const second=JSON.parse(await fs.readFile(path.join(state.second.runDir,'analysis','report.json'),'utf8'));
  signal?.throwIfAborted();
  const report={firstRun:state.first.runDir,secondRun:state.second.runDir,createdAt:new Date().toISOString(),mongoWrites:0,publicationStatus:'unpublished',manualReviewComplete:false,comparison:compareTrialAnalyses(first,second),firstCounts:first.counts,secondCounts:second.counts};
  state.comparison=path.join(state.first.runDir,'repeat-comparison.json');await save(state.comparison,report);
  signal?.throwIfAborted();
  state.status='complete';state.finishedAt=new Date().toISOString();await save(stateFile,state);return {action:'done'};
 }
 // Independent case/capture directory: no first-trial draft cache is inherited.
 await claimRepeatLaunch(state,stateFile,state.plannedSecondRun);
 signal?.throwIfAborted();
 const pid=await launch(state);
 state.second.launcherPid=pid;state.second.launchedAt=new Date().toISOString();state.status='waiting_second';
 await save(stateFile,state);return {action:'launched',pid};
}
