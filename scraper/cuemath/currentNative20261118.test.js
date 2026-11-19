import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261118.json.gz',import.meta.url))))
function replay(edit=(p,s)=>s){const calls=[];return{calls,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{calls.push(url);const p=fixture.responses.find(p=>p.url===url);assert.ok(p,url);assert.equal(init.method,'GET');return Object.defineProperty(new Response(edit(p,Buffer.from(p.bodyBase64,'base64').toString()),{status:p.status,headers:p.headers}),'url',{value:p.url})}}}}
test('current Cuemath reviewed screening program is retained as applicant intake with unknown vacancy count',async()=>{
 const{calls,options}=replay();await assert.rejects(run(options),e=>{assert.equal(e.failureKind,'source_inventory_unavailable');assert.equal(e.nativeCollectionEvidence.closingNativeApplicationModelMatches,true);assert.equal(e.nativeCollectionEvidence.observedVacancyCount,null);assert.equal(e.nativeCollectionEvidence.applicationSubmitted,false);return true});assert.equal(calls.length,6)
})
test('current Cuemath whole program remains pinned and caller cancellation precedes any read',async()=>{
 const changed=replay((p,s)=>p.url.endsWith('/app.js')?s+'\nwindow.newEligibility=true;':s)
 await assert.rejects(run(changed.options),e=>e.failureKind==='parser_or_contract_error')
 const aborted=replay();await assert.rejects(run({...aborted.options,signal:AbortSignal.abort(Error('caller stopped'))}),/caller stopped/);assert.equal(aborted.calls.length,0)
})
