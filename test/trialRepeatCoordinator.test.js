import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {advanceRepeat,createRepeatState} from '../rewriting/trialRepeatCoordinator.js';

const complete=()=>({report:{status:'complete',finishedAt:'done',policyIdentity:'p',mongoWrites:0,summary:{totalSources:1,jobsReviewed:0,generationAttempts:0,generated:0,draftsPassedChecks:0,sourceRetained:0},cases:{},captures:{}},checkpoint:{mode:'dry-run',completedCount:1,totalSources:1,completed:{a:{result:{success:true}}}},terminal:{status:'complete',finishedAt:'done',mongoWrites:0},analysis:null,ownerAlive:false,workerAlive:false});

test('coordinator writes full analysis before starting one isolated second dry trial, then reports both',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-coordinator-'));
 try{
  const first=path.join(directory,'first');await fs.mkdir(first);
  const stateFile=path.join(first,'repeat-state.json');const state=createRepeatState({firstRun:first,outputName:'rewrites-v4',report:complete().report});
  const launched=[];const launch=async current=>{const marker=JSON.parse(await fs.readFile(path.join(first,'analysis','complete.json'),'utf8'));assert.equal(marker.status,'complete');launched.push(current.second.runDir);return 100;};
  const before={...complete(),report:{...complete().report,status:'running'}};
  await advanceRepeat({state,stateFile,snapshot:before,launch});assert.equal(state.second,null);
  await advanceRepeat({state,stateFile,snapshot:complete(),launch});
  assert.equal(launched.length,1);assert.notEqual(state.second.runDir,first);assert.equal(state.status,'waiting_second');
  assert.equal(state.mongoWrites,0);assert.equal(state.second.outputName,'rewrites-v4');
  await fs.mkdir(state.second.runDir);await advanceRepeat({state,stateFile,snapshot:complete(),launch});
  assert.equal(launched.length,1);assert.equal(state.status,'complete');
  assert.equal(JSON.parse(await fs.readFile(path.join(first,'repeat-comparison.json'),'utf8')).comparison.unchangedInputs,0);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('coordinator leaves a durable launch claim when process creation fails and never duplicates it',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-launch-failure-'));
 try{
  const state=createRepeatState({firstRun:directory,outputName:'rewrites-v4',report:complete().report});const stateFile=path.join(directory,'repeat-state.json');
  const launch=async()=>{throw new Error('spawn failed');};
  await assert.rejects(advanceRepeat({state,stateFile,snapshot:complete(),launch}));
  const saved=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.equal(saved.status,'launching_second');assert.ok(saved.second);
  let launched=false;await advanceRepeat({state:saved,stateFile,snapshot:null,launch:async()=>{launched=true;}});
  assert.equal(launched,false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});


test('resource stop cancels reporting without starting the second model',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-resource-stop-'));
 try{
  const state=createRepeatState({firstRun:directory,outputName:'rewrites-v4',report:complete().report}),stateFile=path.join(directory,'repeat-state.json');let launched=false;
  await advanceRepeat({state,stateFile,snapshot:{...complete(),report:{...complete().report,status:'resource_stopped'}},launch:async()=>{launched=true;}});
  assert.equal(launched,false);assert.equal(state.status,'safety_stopped');
  await advanceRepeat({state,stateFile,snapshot:complete(),launch:async()=>{launched=true;}});assert.equal(launched,false);
  assert.equal(JSON.parse(await fs.readFile(stateFile,'utf8')).status,'safety_stopped');
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('an aborted analysis never triggers a second spawn',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'repeat-analysis-abort-'));
 try{
  const state=createRepeatState({firstRun:directory,outputName:'rewrites-v4',report:complete().report}),controller=new AbortController();controller.abort();let launched=false;
  await assert.rejects(advanceRepeat({state,stateFile:path.join(directory,'repeat-state.json'),snapshot:complete(),signal:controller.signal,launch:async()=>{launched=true;}}));
  assert.equal(launched,false);await assert.rejects(fs.access(path.join(directory,'analysis','complete.json')));
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
