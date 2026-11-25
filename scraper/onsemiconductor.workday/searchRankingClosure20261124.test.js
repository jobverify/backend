import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
async function replay(change=packet=>packet){
 let reads=0
 const occurrences=new Map()
 const jobs=await run({sourceTimeoutMs:60000,maxRequests:128,maxDetails:80,maxPages:8,fetchImpl:async(url,init)=>{
  const original=fixture.packets[reads++]
  assert.ok(original,'Only captured public requests')
  assert.equal(String(url),original.url)
  assert.equal(init.method,'GET')
  const count=(occurrences.get(original.url)||0)+1;occurrences.set(original.url,count)
  const packet=change({...original,body:Buffer.from(original.bodyBase64,'base64').toString('utf8')},count)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 }})
 return {jobs,reads}
}
function changeClosingListing(change){return(packet,count)=>{
 if(count!==2||!packet.url.includes('findReqs;'))return packet
 const payload=JSON.parse(packet.body)
 change(payload.items[0].requisitionList)
 return {...packet,body:JSON.stringify(payload)}
}}

test('onsemi reconciles identical job inventory when only finite search scores and distance change',async()=>{
 const {jobs,reads}=await replay(changeClosingListing(rows=>{
  for(const row of rows){row.Distance+=0.003296;row.Relevancy+=0.0032958984375}
 }))
 assert.equal(reads,83)
 assert.equal(jobs.length,34)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 for(const job of jobs){
  assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.country,'India')
  assert.equal(job.nativeLegalEmployer,null)
  const proof=job.sourceNativeClosingEvidence
  assert.equal(proof.inventoryRechecked,true)
  assert.equal(proof.searchRankingMetadataRecomputed,true)
  assert.equal(proof.closingListing.Id,job.jobId)
  assert.notEqual(proof.closingListing.Relevancy,job.nativeSourceRecord.listing.Relevancy)
  assert.equal(proof.closingListing.Title,job.nativeSourceRecord.listing.Title)
 }
 const observed=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(observed.onsemiClosingNativeInventory.length,35)
 assert.equal(observed.onsemiSearchRankingChanges.length,35)
})

for(const [label,change] of [
 ['identity',rows=>rows[0].Id='9999999'],
 ['title',rows=>rows[0].Title+=' changed'],
 ['country',rows=>rows[0].PrimaryLocationCountry='CA'],
 ['employer',rows=>rows[0].LegalEmployer='Other Corporation'],
 ['listing criteria',rows=>rows[0].ExternalQualificationsStr='Changed required qualifications'],
 ['native order',rows=>rows.reverse()],
 ['missing identity',rows=>rows.pop()],
 ['unknown native field',rows=>rows[0].FutureQualificationRule='unreviewed'],
 ['nonnumeric distance',rows=>rows[0].Distance='24.573853'],
 ['nonnumeric relevance',rows=>rows[0].Relevancy={score:24.573853}],
 ['missing score field',rows=>delete rows[0].Relevancy],
])test('onsemi ranking handling still rejects closing '+label+' drift',async()=>{
 await assert.rejects(replay(changeClosingListing(change)),/closing inventory changed|search ranking metadata/)
})

test('onsemi search score handling preserves the exact independent full criteria closure',async()=>{
 await assert.rejects(replay((packet,count)=>{
  const listing=changeClosingListing(rows=>rows.forEach(row=>row.Relevancy+=0.01))(packet,count)
  if(count!==2||!packet.url.includes('Id=%222506716%22'))return listing
  const payload=JSON.parse(packet.body)
  payload.items[0].ExternalQualificationsStr+='<p>New required qualification.</p>'
  return {...packet,body:JSON.stringify(payload)}
 }),/closing own criteria or identity changed/)
})
