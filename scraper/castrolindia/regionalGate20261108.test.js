import test from 'node:test'
import assert from 'node:assert/strict'
import {runNativeCastrol} from './nativeRun.js'
import {CORPORATE} from './nativeContract.js'
const gate='https://www.castrol.com/content/dam/infrastructure/nav-apps/castrol/castrol-geolocation-redirect/landing-page.html'
const response=(url,status,headers={})=>{const r=new Response('Regional consent required',{status,headers});Object.defineProperty(r,'url',{value:url});return r}
for(const [label,make]of[
 ['absolute redirect',()=>response(CORPORATE,302,{location:gate})],
 ['relative redirect',()=>response(CORPORATE,302,{location:new URL(gate).pathname})],
 ['followed reader response',()=>response(gate,200)],
])test('exact Castrol regional gate is blocked without consent or vacancy requests: '+label,async()=>{
 const calls=[]
 await assert.rejects(runNativeCastrol({fetchImpl:async url=>{calls.push(url);return make()}}),e=>{
  assert.equal(e.code,'CASTROL_REGIONAL_CONSENT_REQUIRED');assert.equal(e.failureKind,'public_access_denied');assert.equal(e.softFailure,true);assert.equal(e.upstreamOutage,true);assert.equal(e.abortRetries,true)
  assert.equal(e.inventoryEvidence.listingComplete,false);assert.equal(e.inventoryEvidence.reportedTotal,null);assert.equal(e.inventoryEvidence.indiaFacetCount,null)
  assert.equal(e.nativeEvidence.regionalGateURL,gate);return true
 })
 assert.deepEqual(calls,[CORPORATE])
})
for(const target of [gate+'?unreviewed=1',gate.replace('www.castrol.com','other.example'),'https://job-boards.eu.greenhouse.io/another-employer'])test('unreviewed corporate redirect remains a contract failure: '+target,async()=>{
 await assert.rejects(runNativeCastrol({fetchImpl:async()=>response(CORPORATE,302,{location:target})}),e=>e.code==='PUBLIC_NATIVE_CONTRACT'&&e.abortRetries===true)
})
