import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {CORPORATE,BOARD,API,REMOTE_ENTRY,APP,verifyIndigoBinding,readIndigoJobs} from './nativeContract.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const captured=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-inventory-20261106.json.gz',import.meta.url))))
const fresh=()=>structuredClone(captured)
const config=()=>verifyIndigoBinding(captured.corporate,captured.board,captured.remoteEntry,captured.app)
const run=async(value=fresh(),changeClosing=()=>{})=>{
 const calls=[];let inventories=0
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='indigo')).run({now:value.runAt,
  fetchImpl:async(url)=>{calls.push(url);const payload=structuredClone(value.payload);if(url===API&&++inventories===2)changeClosing(payload)
   const body=url===CORPORATE?value.corporate:url===BOARD?value.board:url===REMOTE_ENTRY?value.remoteEntry:url===APP?value.app:url===API?JSON.stringify(payload):null
   assert.equal(typeof body,'string','only retained public resources allowed');return{status:200,url,text:async()=>body}
  },
 });return{jobs,calls}
}

test('registered current source retains14 full roles and separately holds1 unknown office and2 missing criteria from all17 raw rows',async()=>{
 const {jobs,calls}=await run()
 assert.equal(jobs.length,14);assert.equal(calls.length,6)
 assert.deepEqual(jobs.map(j=>j.jobId),['6576','6575','10096','10094','10097','10300','10423','9743','10471','10482','10450','10497','10507','10509'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.nativeRoleClosingReconciled&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.find(j=>j.jobId==='10471').jobDescription.length>4500)
 const evidence=jobs.nativeCollectionEvidence
 assert.equal(evidence.observedNativeRecords,17);assert.equal(evidence.fullyQualifiedNativeRecords,14)
 assert.equal(evidence.nativeRecords.length,17);assert.deepEqual(evidence.officeHolds.map(h=>h.jobId),['10419'])
 assert.deepEqual(evidence.missingCriteria.map(h=>h.jobId),['6872','6871'])
 assert.equal(evidence.closingInventoryMatches,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('default contract still rejects unknown HYD without assigning India or dropping raw row',()=>{
 assert.throws(()=>readIndigoJobs(captured.payload,{now:captured.runAt,config:config()}),error=>error.code==='INDIGO_UNSUPPORTED_NATIVE_OFFICE')
 assert.equal(captured.payload.result.find(r=>r.jobReqId==='10419').location_obj.results[0].externalCode,'HYD')
})
for(const [label,mutate]of [
 ['unknown-office wrong employer',p=>{p.result.find(r=>r.jobReqId==='10419').legalEntity_obj.name='Other employer'}],
 ['unknown-office conflicting typed country',p=>{p.result.find(r=>r.jobReqId==='10419').location_obj.results[0].country='US'}],
 ['unknown-office wrong public posting identity',p=>{p.result.find(r=>r.jobReqId==='10419').jobReqPostings.results[0].jobReqId='9999'}],
 ['unknown-office impossible publication',p=>{p.result.find(r=>r.jobReqId==='10419').jobReqPostings.results[0].postStartDate='bad-date'}],
 ['known-office conflicting label',p=>{p.result[0].location_obj.results[0].name='Hyderabad'}],
 ['unknown code contradicts a known office label',p=>{p.result.find(r=>r.jobReqId==='10419').location_obj.results[0].name='Mumbai'}],
 ['duplicate held ID',p=>{p.result.push(structuredClone(p.result.find(r=>r.jobReqId==='10419')))}],
])test('office hold cannot mask '+label,async()=>{const f=fresh();mutate(f.payload);await assert.rejects(run(f))})

test('raw unknown-office changes during closing remain fatal rather than certifying selected cohort',async()=>{
 await assert.rejects(run(fresh(),p=>{p.result.find(r=>r.jobReqId==='10419').location_obj.results[0].name='Another office'}),/changed/)
})
