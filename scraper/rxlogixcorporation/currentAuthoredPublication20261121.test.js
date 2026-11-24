import fs from'node:fs'
import http from'node:http'
import https from'node:https'
import{gunzipSync}from'node:zlib'
import test from'node:test'
import assert from'node:assert/strict'
import{run}from'./script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-originals-20261120.json.gz',import.meta.url))))
const board='https://rxlogix.com/careers/',architect='https://rxlogix.com/technical-architect/',perf='https://rxlogix.com/performance-test-engineer/'
const authored=new Set([board,architect,perf])
const body=p=>Buffer.from(p.bodyBase64,'base64').toString('utf8')
async function replay(t,mutate){
 t.mock.method(globalThis,'fetch',()=>{throw Error('Real network prohibited in current-original regression')})
 t.mock.method(http,'request',()=>{throw Error('Real HTTP prohibited')})
 t.mock.method(https,'request',()=>{throw Error('Real HTTPS prohibited')})
 const calls=[],counts=new Map()
 const jobs=await run({requestIntervalMs:0,now:()=>fixture.physicalCompletedAt,fetchImpl:async(value,init)=>{
  const url=String(value),packet=fixture.packets.find(p=>p.requestedURL===url)
  assert.ok(packet,'Only actual captured URL available: '+url);assert.equal(init.method,'GET')
  const ordinal=(counts.get(url)??0)+1;counts.set(url,ordinal);calls.push(url)
  let text=body(packet);if(mutate)text=mutate(text,url,ordinal)
  const response=new Response(text,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }})
 return{jobs,calls}
}
test('actual current authored publication survives unrelated changed analytics bytes without asset or application reads',async t=>{
 const{jobs,calls}=await replay(t)
 assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.title),['Technical Architect','Performance Test Engineer'])
 assert.equal(calls.length,6);assert.ok(calls.every(url=>authored.has(url)))
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,22)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.location,'Noida, India');assert.equal(job.sourceNativeClosingReconciled,true)
  assert.equal(job.sourceRenderedApplicationQualified,false);assert.equal(job.sourceRenderedVisibilityQualified,false)
  assert.equal(job.nativeSourceRecord.originalPublishedApplication.submissionPerformed,false)
  assert.ok(job.jobDescription.includes('Only PDF or DOCX type files are allowed'))
 }
 assert.equal(jobs.nativeCollectionEvidence.assetInteractions,0)
 assert.equal(jobs.nativeCollectionEvidence.applicationInteractions,0)
})
test('arbitrary telemetry and stylesheet bodies cannot become a native-role qualification prerequisite',async t=>{
 const{jobs,calls}=await replay(t,(text,url)=>authored.has(url)?text:'An unrelated telemetry/style deployment changed')
 assert.equal(jobs.length,2);assert.equal(calls.length,6);assert.ok(calls.every(url=>authored.has(url)))
})
for(const[name,mutate]of[
 ['country',(text)=>text.replace('Noida, India','Noida, Japan')],
 ['full criteria',(text)=>text.replace('Travel Expectations','Travel Expectationz')],
])test('same own role keeps a hold when closing '+name+' changes',async t=>{
 await assert.rejects(replay(t,(text,url,ordinal)=>url===architect&&ordinal===2?mutate(text):text),/full original|closing|country/)
})
