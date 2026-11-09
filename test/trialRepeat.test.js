import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {repeatDecision, claimRepeatLaunch, analyzeCompletedTrial, compareTrialAnalyses} from '../rewriting/trialRepeat.js';

const finished='2026-10-05T20:00:00.000Z';
const base=()=>({
 state:{status:'waiting_first',expectedPolicy:'policy',second:null}, ownerAlive:false,workerAlive:false,
 report:{status:'complete',policyIdentity:'policy',mongoWrites:0,finishedAt:finished,summary:{totalSources:1,jobsReviewed:1,generationAttempts:1,generated:1,draftsPassedChecks:1,sourceRetained:0},captures:{a:{finished:true,cursor:1,jobs:1}},cases:{'a.json':{file:'a.json'}}},
 checkpoint:{mode:'dry-run',completedCount:1,totalSources:1},
 terminal:{status:'complete',finishedAt:finished,mongoWrites:0},analysis:{status:'complete',finishedAt:finished,policyIdentity:'policy'}
});

test('repeat waits for queue drain, matching final state and cleanup even after scrape completion',()=>{
 for(const patch of [{report:{...base().report,status:'running'}},{report:{...base().report,captures:{a:{finished:false,cursor:0,jobs:1}}}},{terminal:{...base().terminal,finishedAt:'old'}},{checkpoint:{mode:'dry-run',completedCount:0,totalSources:1}},{ownerAlive:true},{workerAlive:true}])assert.equal(repeatDecision({...base(),...patch}).action,'wait');
 assert.equal(repeatDecision(base()).action,'launch');
});
test('analysis is mandatory; resource stops, Mongo use and policy changes never start another trial',()=>{
 assert.equal(repeatDecision({...base(),analysis:null}).action,'analyze');
 assert.equal(repeatDecision({...base(),analysis:{...base().analysis,finishedAt:'old'}}).action,'analyze');
 for(const patch of [{report:{...base().report,status:'resource_stopped'}},{state:{...base().state,status:'safety_stopped'}},{report:{...base().report,mongoWrites:1}},{report:{...base().report,policyIdentity:'changed'}}])assert.equal(repeatDecision({...base(),...patch}).action,'stop');
});
test('a launch claim persists before spawn and cannot be repeated after coordinator restart',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-claim-'));
 try{
  const state=base().state;const file=path.join(directory,'state.json');
  await claimRepeatLaunch(state,file,path.join(directory,'second'));
  const saved=JSON.parse(await fs.readFile(file,'utf8'));
  assert.equal(saved.status,'launching_second');assert.equal(saved.second.runDir,path.join(directory,'second'));
  await assert.rejects(claimRepeatLaunch(saved,file,path.join(directory,'third')));
  assert.equal(repeatDecision({...base(),state:saved}).action,'wait');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('complete analysis reads every case, preserves unpublished state and separates automated checks from manual review',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-analysis-'));
 try{
  const cases=path.join(directory,'rewrites','cases');await fs.mkdir(cases,{recursive:true});
  const rows=[
   {source:'a',title:'Engineer',applyUrl:'https://example.org/a',inputHash:'h1',status:'draft_passed_checks',reason:null,attempted:true,generated:true,durationMs:1000,sourceDescription:'Design tests and investigate issues for the system.',description:'## Role overview\nYou will design tests and investigate issues for the system.',completion:{value:{overview:'You will design tests and investigate issues for the system.'}},mongoWrites:0,publicationStatus:'unpublished'},
   {source:'b',title:'Architect',applyUrl:'https://example.org/b',inputHash:'h2',status:'source_retained',reason:'generation_timeout',attempted:true,generated:false,durationMs:3000,sourceDescription:'Design reliable systems.',description:'Design reliable systems.',mongoWrites:0,publicationStatus:'unpublished'}
  ];
  for(let i=0;i<rows.length;i++)await fs.writeFile(path.join(cases,i+'.json'),JSON.stringify(rows[i]));
  const report={...base().report,summary:{totalSources:2,jobsReviewed:2,generationAttempts:2,generated:1,draftsPassedChecks:1,sourceRetained:1},cases:{'0.json':{},'1.json':{}},captures:{}};
  const checkpoint={mode:'dry-run',completedCount:2,totalSources:2,completed:{a:{result:{success:true}},b:{result:{success:false}}}};
  const result=await analyzeCompletedTrial({runDir:directory,outputName:'rewrites',report,checkpoint});
  assert.equal(result.counts.jobsReviewed,2);assert.equal(result.counts.generationAttempts,2);assert.equal(result.counts.generated,1);
  assert.equal(result.timing.medianAttemptMs,2000);assert.equal(result.scrape.failures,1);assert.equal(result.manualReview.complete,false);
  assert.equal(result.reasons.generation_timeout,1);assert.equal(result.flags.nearCopiedOverview,1);
  assert.ok((await fs.readFile(path.join(directory,'analysis','review-samples.md'),'utf8')).includes('Design tests and investigate issues'));
  const marker=JSON.parse(await fs.readFile(path.join(directory,'analysis','complete.json'),'utf8'));assert.equal(marker.status,'complete');assert.equal(marker.finishedAt,finished);
  // A published case must fail closed, rather than produce a misleading zero-write report.
  await fs.writeFile(path.join(cases,'0.json'),JSON.stringify({...rows[0],mongoWrites:1}));
  await assert.rejects(analyzeCompletedTrial({runDir:directory,outputName:'rewrites',report,checkpoint}));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('repeat comparison separates unchanged input reproducibility from changed, added and missing source jobs',()=>{
 const a={jobs:[{key:'a',inputHash:'same',status:'draft_passed_checks',overviewHash:'one'},{key:'b',inputHash:'old'},{key:'c',inputHash:'old'}]};
 const b={jobs:[{key:'a',inputHash:'same',status:'draft_passed_checks',overviewHash:'two'},{key:'b',inputHash:'new'},{key:'d',inputHash:'new'}]};
 assert.deepEqual(compareTrialAnalyses(a,b),{unchangedInputs:1,changedInputs:1,addedJobs:1,missingJobs:1,unchangedStatus:1,identicalOverview:0});
});


test('a partial or unsafe trial cannot get an analysis-complete marker',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-partial-'));
 try{
  await assert.rejects(analyzeCompletedTrial({runDir:directory,outputName:'rewrites',report:{...base().report,status:'running'},checkpoint:base().checkpoint}));
  await assert.rejects(analyzeCompletedTrial({runDir:directory,outputName:'rewrites',report:base().report,checkpoint:{...base().checkpoint,completedCount:0}}));
  await assert.rejects(fs.access(path.join(directory,'analysis','complete.json')));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
