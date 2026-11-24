import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {activeDocument,qualifyCurrentIndiaDetail} from './native.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-native-prefix-20261120.json.gz',import.meta.url))))
const india=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-india-20261120.json.gz',import.meta.url))))
const indiaHTML=Buffer.from(india.packet.bodyBase64,'base64').toString()
const firstForeign=fixture.packets.find(row=>row.requestedURL.endsWith('_15955.aspx'))
const originalForeign=Buffer.from(firstForeign.bodyBase64,'base64').toString()
const foreignTitle=activeDocument(originalForeign).nodes(n=>n.tag==='h1').map(n=>activeDocument(originalForeign).text(n))[0]
const replay=(foreignCountry=null)=>{
 let ordinal=0,coverageBoundary=0
 return {options:{fetchImpl:async(url,init)=>{
  assert.equal(init.redirect,'manual')
  const packet=fixture.packets[ordinal]
  if(!packet){coverageBoundary++;throw Error('Offline current native capture boundary: later detail was not fetched')}
  assert.equal(url,packet.requestedURL);ordinal++
  let body=Buffer.from(packet.bodyBase64,'base64').toString()
  if(foreignCountry&&url===firstForeign.requestedURL){
   // Negative sibling mutation: the only returned India role remains the
   // untouched original 16009. This synthetic sibling is never claimed live.
   body=indiaHTML.replaceAll(new URL(india.row.sourceUrl).pathname,new URL(url).pathname)
    .replaceAll(india.row.title,foreignTitle).replaceAll('2026-16009','2026-15955')
    .replaceAll('International, Inde, Nagpur','International, '+foreignCountry+', Nagpur')
  }
  return Object.defineProperty(new Response(body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }},counts:()=>({originalResponses:ordinal,coverageBoundary})}
}
for(const country of [null,'USA','Unknown'])test('Dassault independent India closing survives retained sibling holds '+country,async()=>{
 const io=replay(country),jobs=await run(io.options)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'16009')
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].nativeOwnRoleClosingVerified,true)
 assert.ok(jobs.nativeCollectionEvidence.unresolved.length>0,'unsupported and unfetched siblings retained')
 assert.ok(jobs.nativeCollectionEvidence.unresolved.some(row=>row.reason.includes('not fetched')||row.reason.includes('capture boundary')),'offline availability boundary retained')
 if(country)assert.ok(jobs.nativeCollectionEvidence.unresolved.some(row=>row.id==='15955'),'modern foreign or unknown sibling is held')
 assert.equal(io.counts().originalResponses,fixture.packets.length)
 assert.equal(io.counts().coverageBoundary,1)
})
test('Dassault reference year is native identity rather than an unrelated current-year prerequisite',()=>{
 const job=qualifyCurrentIndiaDetail(activeDocument(indiaHTML.replaceAll('2026-16009','2027-16009')),{...india.row,reference:'2027-16009'})
 assert.equal(job.requisitionId,'2027-16009');assert.equal(job.postingDate,india.row.postingDate)
})
