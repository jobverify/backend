import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {runMyKaarmaNative} from './nativeReader20261107.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const root=new URL('./test-data/deployment-20261113/',import.meta.url)
const manifest=JSON.parse(readFileSync(new URL('reader-manifest.json',root),'utf8'))
const packets=new Map(manifest.map(row=>[row.url,{...row,body:gunzipSync(readFileSync(new URL(row.fixture,root))).toString('utf8')}]))
const second='https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F&page=1'
async function replay(change=value=>value){
 const counts=new Map()
 const jobs=await runMyKaarmaNative({now:()=> '2026-11-13T12:00:00.000Z',fetchImpl:async url=>{
  const packet=packets.get(url);assert.ok(packet,'Only captured declared public reads: '+url)
  const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
  const value=change({url,occurrence,...packet}),response=new Response(value.body,{status:value.status??200,headers:{'content-type':value.type}})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 return{jobs,counts}
}
test('current MyKaarma reader reconciles both native pages twice and all seven complete India roles/applications',async()=>{
 const{jobs,counts}=await replay()
 assert.equal(jobs.length,7);assert.equal(counts.get(second),2)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeLocationRows,22)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeUniqueVacancies,16)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.nativeRoleClosingReconciled&&job.nativeApplicationRecord.jobPost.uuid===job.jobId&&job.jobDescription.length>3000))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).pagesFetched,4)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
test('MyKaarma terminal page denial cannot emit a staged partial native inventory',async()=>{
 await assert.rejects(replay(value=>value.url===second?{...value,status:404}:value),/HTTP 404/)
})
test('MyKaarma changed closing terminal page cannot emit staged India roles',async()=>{
 await assert.rejects(replay(value=>value.url===second&&value.occurrence===2?{...value,body:value.body.replace('"totalItems":22','"totalItems":23')}:value),/pagination|count|listing/)
})
