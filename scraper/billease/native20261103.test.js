import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const options=(change=packet=>packet)=>({fetchPage:async url=>{
 const found=packets.find(row=>row.url===url);assert.ok(found,url)
 const row=change(structuredClone(found))
 return{status:row.status,url:row.finalUrl,body:row.body,contentType:row.contentType||'text/html; charset=utf-8'}
}})

test('current BillEase public inventory does not use its private internal-jobs menu as a blanket scope gate',async()=>{
 const jobs=await run(options()),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,0)
 assert.doesNotMatch(evidence.reason,/additional-native-hiring-scope/)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
})

test('BillEase loads full public details for missing listing countries and keeps identity-bound foreign and unknown outcomes distinct',async()=>{
 const jobs=await run(options()),summary=jobs.nativeInventorySummary
 assert.ok(summary.publicDetailObservations)
 const security=summary.publicDetailObservations.find(row=>row.id==='8a74a26b-8167-434b-964e-61d4fd8bebd2')
 assert.equal(security.country,'Philippines')
 assert.equal(security.countryEvidence,'native full-description Location label')
 assert.ok(security.sourceDescription.includes('What success looks like (first 6 months)'))
 const sales=summary.publicDetailObservations.find(row=>row.id==='e4a2c8c0-7687-4e82-af62-21be3c64f7ee')
 assert.equal(sales.country,null)
 assert.match(sales.sourceDescription,/Nationwide/)
 assert.ok(summary.publicDetailFailures.some(row=>row.httpStatus===429))
})

test('BillEase does not qualify a foreign detail whose public application identity belongs to another posting',async()=>{
 const jobs=await run(options(packet=>{if(packet.url.endsWith('/jobs/8a74a26b-8167-434b-964e-61d4fd8bebd2'))packet.body=packet.body.replaceAll('8a74a26b-8167-434b-964e-61d4fd8bebd2','11111111-1111-1111-1111-111111111111');return packet}))
 assert.ok(jobs.nativeInventorySummary.publicDetailFailures.some(row=>row.id==='8a74a26b-8167-434b-964e-61d4fd8bebd2'))
})

test('BillEase cancellation settles an injected public fetch which ignores its signal',async()=>{
 const controller=new AbortController(),reason=Error('stop BillEase')
 await assert.rejects(run({signal:controller.signal,fetchPage:()=>{controller.abort(reason);return new Promise(()=>{})}}),error=>error===reason)
})

test('BillEase does not collapse a mixed country Location declaration into India',async()=>{
 const jobs=await run(options(packet=>{
  if(packet.url.endsWith('/jobs/8a74a26b-8167-434b-964e-61d4fd8bebd2'))packet.body=packet.body.replaceAll('Philippines (hybrid / remote-friendly)','India (Philippines)')
  return packet
 }))
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeInventorySummary.publicDetailObservations.find(row=>row.id==='8a74a26b-8167-434b-964e-61d4fd8bebd2').country,null)
})

test('BillEase stops further unresolved detail requests after the first actual native429',async()=>{
 let rateLimitedResponses=0
 const jobs=await run(options(packet=>{if(packet.status===429)rateLimitedResponses++;return packet}))
 assert.equal(rateLimitedResponses,1)
 assert.ok(jobs.nativeInventorySummary.publicDetailFailures.some(row=>row.notAttemptedAfterRateLimit===true))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('a closing native429 retains observed public criteria and unknown inventory instead of losing the whole source',async()=>{
 let boards=0
 const jobs=await run(options(packet=>{
  if(packet.url==='https://billease.careers-page.com/'&&++boards===2){packet.status=429;packet.body=packets.find(row=>row.status===429).body}
  return packet
 }))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeInventorySummary.closingNativeRoleCount,null)
 assert.ok(jobs.nativeInventorySummary.publicDetailObservations.length>0)
 assert.match(readInventoryEvidence(jobs).reason,/closing-public-inventory-unavailable/)
})

test('native description country evidence cannot erase a conflicting current corporate country declaration',async()=>{
 const id='8a74a26b-8167-434b-964e-61d4fd8bebd2'
 const jobs=await run(options(packet=>{if(packet.url.endsWith('/jobs/'+id))packet.body=packet.body.replaceAll('Philippines (hybrid / remote-friendly)','India (hybrid / remote-friendly)');return packet}))
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,new RegExp('corporate-native-country-differs:'+id))
})
