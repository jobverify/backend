import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeout as delay} from 'node:timers/promises'
import {runCurrentFrontProgramme} from './currentProgramme.js'
const corporate='https://front.com/jobs'
function refused({caller,reason,never=false,reject=false}={}){
 const counts={readers:0,cancels:0,settled:false}
 const response={status:403,headers:new Headers({'content-type':'text/html'}),body:{getReader(){counts.readers++;assert.fail('Denied body reader opened')},async cancel(){counts.cancels++;if(never)return new Promise(()=>{});await delay(30);counts.settled=true;if(reject)throw Error('Controlled disposal rejection')}}}
 Object.defineProperty(response,'url',{get(){if(caller&&!caller.signal.aborted)caller.abort(reason);return corporate}})
 return {response,counts}
}
test('known denied response awaits owned cancellation before returning its original status',async()=>{const t=refused();await assert.rejects(runCurrentFrontProgramme({fetchImpl:async()=>t.response,requestIntervalMs:0}),e=>e.status===403);assert.deepEqual(t.counts,{readers:0,cancels:1,settled:true})})
test('late-response null and frozen caller reasons remain exact after awaited disposal',async()=>{for(const reason of [null,Object.freeze({caller:'controlled-review'})]){const caller=new AbortController(),t=refused({caller,reason});let caught=false;try{await runCurrentFrontProgramme({fetchImpl:async()=>t.response,requestIntervalMs:0,signal:caller.signal})}catch(error){caught=true;assert.equal(error,reason)}assert.equal(caught,true);assert.deepEqual(t.counts,{readers:0,cancels:1,settled:true})}})
test('nonsettling cancellation has a bounded grace without replacing the original denial',{timeout:3500},async()=>{const t=refused({never:true});const start=performance.now();await assert.rejects(runCurrentFrontProgramme({fetchImpl:async()=>t.response,requestIntervalMs:0}),e=>e.status===403);assert.ok(performance.now()-start>=900);assert.deepEqual(t.counts,{readers:0,cancels:1,settled:false})})
test('cleanup rejection preserves the original denied response',async()=>{const t=refused({reject:true});await assert.rejects(runCurrentFrontProgramme({fetchImpl:async()=>t.response,requestIntervalMs:0}),e=>e.status===403);assert.deepEqual(t.counts,{readers:0,cancels:1,settled:true})})

test('a response arriving after caller cancellation is disposed within the bounded grace',async()=>{const caller=new AbortController(),reason=Object.freeze({caller:'late-transport'}),t=refused();let caught=false;try{await runCurrentFrontProgramme({signal:caller.signal,requestIntervalMs:0,fetchImpl:async()=>{caller.abort(reason);await delay(20);return t.response}})}catch(error){caught=true;assert.equal(error,reason)}assert.equal(caught,true);assert.deepEqual(t.counts,{readers:0,cancels:1,settled:true})})
