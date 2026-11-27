import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CORPORATE} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const captured=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261117.json.gz',import.meta.url))))
function replay({persistent=false,cancel}={}){
 let attempt=0
 const requests=[],controller=new AbortController(),reason=Object.freeze({stop:'Boston inventory capture'})
 return {requests,controller,reason,now:()=> '2026-11-16T21:25:00.000Z',signal:controller.signal,fetchText:async url=>{
  requests.push(url);if(url===CORPORATE)attempt++
  const packet=captured.responses.find(packet=>packet.requestedURL===url)
  assert.ok(packet,'Only captured native public requests: '+url)
  return Buffer.from(packet.bodyBase64,'base64').toString('utf8')
 },fetchJson:async url=>{
  requests.push(url)
  const packet=captured.responses.find(packet=>packet.requestedURL===url)
  assert.ok(packet,'Only captured native public requests: '+url)
  const payload=JSON.parse(Buffer.from(packet.bodyBase64,'base64'))
  if(new URL(url).searchParams.get('start')==='10'&&(persistent||attempt===1)){
   payload.data.count--
   if(cancel)controller.abort(reason)
  }
  if(attempt===1&&new URL(url).searchParams.get('start')==='0'&&!new URL(url).searchParams.has('filter_country')){
   payload.data.positions[0].id=777777777777777
   payload.data.positions[0].positionUrl='/careers/job/777777777777777'
  }
  return payload
 }}
}

test('Boston restarts a transient total drift once and reconciles all pages from a fresh native pass',async()=>{
 const io=replay(),jobs=await run(io)
 assert.equal(jobs.length,0)
 assert.equal(io.requests.filter(url=>url===CORPORATE).length,2)
 assert.equal(io.requests.length,112)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.reportedTotal,510)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const attempts=jobs.nativeCollectionEvidence.nativeCaptureAttempts
 assert.equal(attempts.length,2)
 assert.equal(attempts[0].nativeInventoryChange.expectedTotal,510)
 assert.equal(attempts[0].nativeInventoryChange.reportedTotal,509)
 assert.equal(attempts[0].nativeInventoryChange.opening.pages[0].data.positions[0].id,777777777777777)
 assert.equal(attempts[1].status,'reconciled')
 assert.equal(jobs.nativeCollectionEvidence.observedNativeRecords,510)
 assert.equal(jobs.nativeCollectionEvidence.quarantinedFacetRecords,1)
})

test('Boston persistent total drift is not accepted as a moving total after the single restart',async()=>{
 const io=replay({persistent:true})
 await assert.rejects(run(io),error=>{
  assert.equal(error.code,'BOSTON_NATIVE_INVENTORY_CHANGED')
  assert.equal(error.nativeCaptureAttempts.length,2)
  assert.ok(error.nativeCaptureAttempts.every(attempt=>attempt.status==='discarded-inventory-change'))
  return true
 })
 assert.equal(io.requests.length,8)
})

test('Boston caller cancellation during drift wins without starting another native pass',async()=>{
 const io=replay({cancel:true})
 await assert.rejects(run(io),error=>error===io.reason)
 assert.equal(io.requests.length,4)
})

test('Boston HTTP denial remains a failure without an inventory retry',async()=>{
 const io=replay(),read=io.fetchJson
 io.fetchJson=async url=>{if(new URL(url).searchParams.get('start')==='10'){io.requests.push(url);throw Object.assign(Error('HTTP 403'),{status:403})}return read(url)}
 await assert.rejects(run(io),error=>error.status===403)
 assert.equal(io.requests.length,4)
})
