import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {runMemoryLimitedChild} from '../scripts/runFullDescriptionDryRun.js';
import {createResourceMonitor} from '../rewriting/resourceGuard.js';

test('resource monitor propagates a rejected stop instead of swallowing it',async()=>{
  const failure=new Error('termination denied');
  const monitor=createResourceMonitor({sample:()=>({cpuPercent:0,memoryPercent:91}),onStop:async()=>{throw failure;}});
  await assert.rejects(monitor.check(),error=>error===failure);
  assert.equal(monitor.stopped,true);
});

test('periodic monitor stop failures remain observable without an unhandled rejection',{timeout:3000},async()=>{
  const failure=new Error('periodic termination denied');
  let samples=0;
  const monitor=createResourceMonitor({
    intervalMs:20,sample:()=>({cpuPercent:0,memoryPercent:samples++?91:50}),
    onStop:async()=>{throw failure;},
  });
  try{await monitor.start();assert.equal(await monitor.failure,failure);}
  finally{monitor.stop();}
});

test('failed child termination settles with the original error and cleans up its child',{timeout:5000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-stop-failure-'));
  const failure=new Error('injected termination denied');
  let samples=0;
  await assert.rejects(runMemoryLimitedChild({
    runDir:directory,command:process.execPath,
    // Even the old broken supervisor eventually settles during this RED test.
    args:['-e','setTimeout(()=>{},2000)'],intervalMs:50,
    sample:()=>({cpuPercent:0,memoryPercent:samples++<2?50:91}),
    terminateChild:async()=>{throw failure;},shutdownTimeoutMs:500,
  }),error=>error===failure);
  const cutoff=JSON.parse(await fs.readFile(path.join(directory,'memory-stop.json'),'utf8'));
  assert.equal(cutoff.automaticResume,false);
  assert.throws(()=>process.kill(cutoff.childPid,0),error=>error.code==='ESRCH');
});

test('a termination operation that never settles has a bounded failure and child cleanup',{timeout:5000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-stop-timeout-'));
  let samples=0;
  await assert.rejects(runMemoryLimitedChild({
    runDir:directory,command:process.execPath,args:['-e','setTimeout(()=>{},2000)'],intervalMs:50,
    sample:()=>({cpuPercent:0,memoryPercent:samples++<2?50:91}),
    terminateChild:()=>new Promise(()=>{}),shutdownTimeoutMs:100,
  }),/Child termination timed out/);
  const {pid}=JSON.parse(await fs.readFile(path.join(directory,'active-child.json'),'utf8'));
  assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH');
});

test('successful termination without child exit also has a bounded failure',{timeout:5000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-exit-timeout-'));
  let samples=0;
  await assert.rejects(runMemoryLimitedChild({
    runDir:directory,command:process.execPath,args:['-e','setTimeout(()=>{},2000)'],intervalMs:50,
    sample:()=>({cpuPercent:0,memoryPercent:samples++<2?50:91}),
    terminateChild:async()=>{},shutdownTimeoutMs:100,
  }),/Child exit after termination timed out/);
  const {pid}=JSON.parse(await fs.readFile(path.join(directory,'active-child.json'),'utf8'));
  assert.throws(()=>process.kill(pid,0),error=>error.code==='ESRCH');
});

test('spawn failures reject promptly without leaking monitor timers',{timeout:3000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-spawn-failure-'));
  await assert.rejects(runMemoryLimitedChild({
    runDir:directory,command:path.join(directory,'missing-executable'),args:[],intervalMs:50,
    sample:()=>({cpuPercent:0,memoryPercent:50}),
  }),error=>error.code==='ENOENT');
});

test('cleanup failure preserves the original termination error',{timeout:3000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-cleanup-failure-'));
  const terminationError=new Error('termination denied');
  const cleanupError=new Error('direct child cleanup denied');
  let samples=0,childExit;
  try{
    await assert.rejects(runMemoryLimitedChild({
      runDir:directory,command:process.execPath,args:['-e','setTimeout(()=>{},400)'],intervalMs:50,
      sample:()=>({cpuPercent:0,memoryPercent:samples++<2?50:91}),
      terminateChild:async child=>{
        childExit=new Promise(resolve=>child.once('exit',resolve));
        child.kill=()=>{throw cleanupError;};
        throw terminationError;
      },shutdownTimeoutMs:100,
    }),error=>error instanceof AggregateError
      && error.cause===terminationError
      && error.errors.includes(terminationError)&&error.errors.includes(cleanupError));
  }finally{
    // This finite-lived fixture exits naturally even when both termination
    // operations are deliberately denied.
    if(childExit)await childExit;
  }
});

test('RAM above 90 kills its real child, preserves the cutoff and stays stopped',{timeout:5000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-guard-'));
  let samples=0;
  const outcome=await runMemoryLimitedChild({runDir:directory,command:process.execPath,args:['-e','setTimeout(()=>{},2000)'],intervalMs:100,
    sample:()=>({cpuPercent:100,memoryPercent:samples++<2?90:90.1}),
    // Exercise the real child lifecycle without depending on Windows taskkill
    // permission, which is separately covered by the failure-path regression.
    terminateChild:async child=>{assert.equal(child.kill('SIGKILL'),true);}});
  assert.equal(outcome.status,'resource_stopped');assert.equal(outcome.reading.memoryPercent,90.1);
  const cutoff=JSON.parse(await fs.readFile(path.join(directory,'memory-stop.json'),'utf8'));
  assert.equal(cutoff.automaticResume,false);assert.ok(cutoff.childPid>0);
  assert.throws(()=>process.kill(cutoff.childPid,0),error=>error.code==='ESRCH');
});
test('100 percent CPU alone does not trigger the user RAM cutoff',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-cpu-'));
  const outcome=await runMemoryLimitedChild({runDir:directory,command:process.execPath,args:['-e','setTimeout(()=>{},200)'],intervalMs:50,
    sample:()=>({cpuPercent:100,memoryPercent:50})});
  assert.equal(outcome.status,'exited');assert.equal(outcome.exitCode,0);
});
test('already high RAM prevents even launching a child',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'description-preflight-'));
  const outcome=await runMemoryLimitedChild({runDir:directory,command:process.execPath,args:['-e','throw new Error("must not launch")'],sample:()=>({cpuPercent:0,memoryPercent:91})});
  assert.equal(outcome.status,'resource_stopped');
  const cutoff=JSON.parse(await fs.readFile(path.join(directory,'memory-stop.json'),'utf8'));assert.equal(cutoff.childPid,null);
});
