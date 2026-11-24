import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../dassaultaviationindia/test-inputs/current-native-prefix-20261120.json.gz',import.meta.url))))
const roleURL='https://dassault-aviation-cand.talent-soft.com/offre-de-emploi/emploi-vie-ingenieur-de-production-nagpur-inde-f-h_16009.aspx'
// Genuine same-employer Nov20 retained HTTP prefix. Later unavailable fixtures
// are an explicit offline boundary, never a fabricated complete inventory.
function replay({mutate,denied=false}={}){
 let ordinal=0,boundary=0,bodyReads=0;const requested=[],occurrences=new Map()
 return {options:{requestIntervalMs:0,sourceTimeoutMs:20000,timeoutMs:20000,fetchImpl:async(url,init)=>{
  requested.push(url);assert.equal(init.redirect,'manual')
  if(denied)return{status:403,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:async()=>{},getReader(){bodyReads++;throw Error('Denied body must not be consumed')}}}
  const packet=fixture.packets[ordinal]
  if(!packet){boundary++;throw Error('Explicit retained fixture boundary; later role not physically captured in this fixture')}
  assert.equal(url,packet.requestedURL);ordinal++
  const nth=(occurrences.get(url)??0)+1;occurrences.set(url,nth)
  let body=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
  if(mutate)body=mutate(body,url,nth)
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }},stats:()=>({ordinal,boundary,bodyReads,requested})}
}
test('separate Dassault source uses actual same-employer roles with its own registered identity and open scope',async()=>{
 const io=replay(),jobs=await run(io.options)
 assert.equal(jobs.length,1);assert.equal(jobs[0].source,'dassaultaviation');assert.equal(jobs[0].company,'Dassault Aviation')
 assert.equal(jobs[0].jobId,'16009');assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].nativeEmployerName,/Dassault Reliance Aerospace Limited/)
 assert.match(jobs[0].jobDescription,/moins de deux ans/);assert.match(jobs[0].jobDescription,/lettre de motivation/)
 assert.equal(jobs[0].nativeOwnRoleClosingVerified,true);assert.equal(jobs[0].applicationVisited,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeCollectionEvidence.source,'dassaultaviation')
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.ok(jobs.nativeCollectionEvidence.unresolved.length>0)
 assert.equal(io.stats().ordinal,fixture.packets.length);assert.equal(io.stats().boundary,1)
})
for(const [name,change]of [
 ['native country contradiction',s=>s.replace('International, Inde, Nagpur','International, France, Nagpur')],
 ['changed closing full criteria',(s,url,nth)=>nth===2?s.replace('moins de deux ans','moins de neuf ans'):s],
 ['unrelated own application',s=>s.replace('action="./emploi-vie-ingenieur-de-production-nagpur-inde-f-h_16009.aspx"','action="https://unrelated.example/apply"')],
]){
 test('separate source holds '+name,async()=>{
  let changes=0
  const io=replay({mutate:(body,url,nth)=>{if(url!==roleURL)return body;const value=change(body,url,nth);if(value!==body)changes++;return value}})
  await assert.rejects(()=>run(io.options));assert.ok(changes>0,'genuine own native role was mutated')
 })
}
test('HTTP403 is metadata-first and terminates the publisher before reading its body',async()=>{
 const io=replay({denied:true});await assert.rejects(()=>run(io.options),error=>{assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.httpStatus??error.status,403);return true})
 assert.equal(io.stats().requested.length,1);assert.equal(io.stats().bodyReads,0)
})
for(const reason of [null,Object.freeze({kind:'caller-owned-frozen-reason'})])test('caller reason is preserved without public reads '+String(reason),async()=>{
 const controller=new AbortController();controller.abort(reason);let calls=0,thrown=false
 try{await run({signal:controller.signal,fetchImpl:()=>{calls++;throw Error('must not fetch')}})}catch(error){thrown=true;assert.equal(error,reason)}
 assert.equal(thrown,true);assert.equal(calls,0)
})
test('body-only callbacks cannot accidentally start a physical native acquisition',async()=>{
 let calls=0
 await assert.rejects(()=>run({fetchPage:async()=>{calls++;throw Error('body-only hook must be refused')}}))
 assert.equal(calls,0)
})
