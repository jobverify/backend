import test from 'node:test';
import assert from 'node:assert/strict';
import {cpuTotals,resourceSnapshot,createResourceMonitor} from '../rewriting/resourceGuard.js';
test('CPU delta includes every logical CPU; first CPU reading is unknown',()=>{
 const a=cpuTotals([{times:{idle:80,user:20}},{times:{idle:60,user:40}}]);
 const b=cpuTotals([{times:{idle:100,user:100}},{times:{idle:80,user:120}}]);
 assert.deepEqual(a,{idle:140,total:200});
 assert.equal(resourceSnapshot(a,b,100,20).cpuPercent,80);
 assert.equal(resourceSnapshot(null,b,100,20).cpuPercent,null);
});
test('a measured CPU or RAM value above 90 stops once and logs the threshold sample',async()=>{
 for(const breach of [{cpuPercent:90.1,memoryPercent:60},{cpuPercent:30,memoryPercent:90.1}]){
  let stopped=0;const logs=[];let n=0;
  const monitor=createResourceMonitor({sample:()=>n++?breach:{cpuPercent:90,memoryPercent:90},onSample:s=>logs.push(s),onStop:()=>stopped++});
  await monitor.check();assert.equal(stopped,0);
  await monitor.check();await monitor.check();assert.equal(stopped,1);assert.deepEqual(logs.at(-1),breach);
 }
});
test('invalid resource readings and resource log failure fail closed',async()=>{
 for(const options of [{sample:()=>({cpuPercent:NaN,memoryPercent:30})},{sample:()=>({cpuPercent:20,memoryPercent:40}),onSample:()=>{throw new Error('disk full')}}]){
  let reason;const monitor=createResourceMonitor({...options,onStop:(_s,r)=>{reason=r;}});
  await monitor.check();assert.equal(reason,'monitor_error');assert.equal(monitor.stopped,true);
 }
});
test('overlapping checks cannot race or restart a stopped monitor',async()=>{
 let release;const pending=new Promise(r=>{release=r});let stopped=0,samples=0;
 const monitor=createResourceMonitor({sample:async()=>{samples++;await pending;return {cpuPercent:95,memoryPercent:40}},onStop:()=>stopped++});
 const first=monitor.check();await monitor.check();release();await first;await monitor.check();
 assert.equal(samples,1);assert.equal(stopped,1);
});
