import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,NATIVE_CONFIG} from './script.js'
import {runNative} from '../../scraper-support/shared/rmkNativePair.js'
import {parseRmkListing} from '../../scraper-support/shared/successFactorsRmk.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const captured=JSON.parse(readFileSync(new URL('../../scraper-support/tests/fixtures/rmkNativePair/native-capture.json',import.meta.url))).sources.hershey
const read=name=>gunzipSync(Buffer.from(captured[name].gzipBase64,'base64')).toString('utf8')
const search=NATIVE_CONFIG.origin+'/search/'
function replay(change=packet=>packet){
 const pages=new Map(),requests=[]
 for(const name of Object.keys(captured).filter(name=>name.endsWith('.json'))){
  const receipt=JSON.parse(read(name)),bodyFile=receipt.bodyFile??receipt.hops?.at(-1)?.bodyFile
  if(receipt.requestedURL&&receipt.status===200&&bodyFile)pages.set(receipt.requestedURL,read(bodyFile))
 }
 let attempt=0
 return {requests,now:'2026-10-21T23:39:13.532Z',fetchText:async(url,{signal})=>{
  requests.push(url)
  if(url===NATIVE_CONFIG.home)attempt++
  const body=url===search?read('003-search-hop0.body'):pages.get(url)
  assert.equal(typeof body,'string','Only captured native public requests: '+url)
  const packet=change({url,body,attempt,signal})
  return packet.body
 }}
}
const drift=packet=>packet.url.includes('startrow=25')?{...packet,body:packet.body.replace(/of <b>323<\/b>/g,'of <b>324</b>')}:packet

test('Hershey restarts a changing pagination pass once and returns only a fully reconciled fresh pass',async()=>{
 const io=replay(packet=>packet.attempt===1?drift(packet):packet)
 const jobs=await run(io),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,9)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,9)
 assert.deepEqual(io.requests.slice(0,5),[NATIVE_CONFIG.home,NATIVE_CONFIG.origin+'/',search,NATIVE_CONFIG.origin+'/search?q=&sortColumn=referencedate&sortDirection=desc&startrow=25',NATIVE_CONFIG.home])
 assert.equal(io.requests.filter(url=>url===NATIVE_CONFIG.home).length,2)
 assert.equal(evidence.reportedTotal,323)
 assert.equal(evidence.listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const attempts=jobs.nativeCollectionEvidence.nativeCaptureAttempts
 assert.equal(attempts.length,2)
 assert.equal(attempts[0].status,'discarded-inventory-change')
 assert.equal(attempts[0].nativeInventoryChange.expectedTotal,323)
 assert.equal(attempts[0].nativeInventoryChange.reportedTotal,324)
 assert.equal(attempts[0].nativeInventoryChange.opening.rows.length,25)
 assert.equal(attempts[1].status,'reconciled')
})

test('shared RMK total drift supplies typed evidence while preserving its fail closed contract',async()=>{
 await assert.rejects(runNative(NATIVE_CONFIG,replay(drift)),error=>{
  assert.equal(error.code,'RMK_NATIVE_INVENTORY_CHANGED')
  assert.equal(error.incompleteScope,true)
  assert.equal(error.nativeInventoryChange.expectedStart,26)
  assert.equal(error.nativeInventoryChange.reportedStart,26)
  assert.equal(error.nativeInventoryChange.currentPage.jobs.length,25)
  return true
 })
})

test('Hershey persistent total churn still fails after one restart and retains both attempts',async()=>{
 const io=replay(drift)
 await assert.rejects(run(io),error=>{
  assert.equal(error.code,'RMK_NATIVE_INVENTORY_CHANGED')
  assert.equal(error.nativeCaptureAttempts.length,2)
  assert.ok(error.nativeCaptureAttempts.every(attempt=>attempt.status==='discarded-inventory-change'))
  return true
 })
 assert.equal(io.requests.length,8)
})

test('Hershey discards first pass role identities when restarting instead of merging observed pages',async()=>{
 let discardedId
 const io=replay(packet=>{
  if(packet.attempt!==1)return packet
  if(packet.url===search){
   const row=parseRmkListing(packet.body,NATIVE_CONFIG).jobs[0]
   discardedId='9999999999'
   return{...packet,body:packet.body.replaceAll('/'+row.jobId+'/', '/'+discardedId+'/')}
  }
  return drift(packet)
 })
 const jobs=await run(io)
 assert.equal(jobs.length,9)
 assert.ok(jobs.every(job=>job.nativePublicJobId!==discardedId))
 assert.equal(jobs.nativeCollectionEvidence.nativeCaptureAttempts[0].nativeInventoryChange.opening.rows[0].jobId,discardedId)
})

test('Hershey cancellation during a drifting response wins without another public read',async()=>{
 const controller=new AbortController(),reason=Object.freeze({stop:'native inventory capture'})
 const io=replay(packet=>{const changed=drift(packet);if(changed!==packet)controller.abort(reason);return changed})
 await assert.rejects(run({...io,signal:controller.signal}),error=>error===reason)
 assert.equal(io.requests.length,4)
})

test('Hershey access denials do not trigger an inventory restart',async()=>{
 const io=replay(packet=>{if(packet.url.includes('startrow=25'))throw Object.assign(Error('HTTP 403'),{status:403});return packet})
 await assert.rejects(run(io),error=>error.status===403)
 assert.equal(io.requests.length,4)
})
