import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {run,LISTING_API_URL,DETAIL_API_URL,buildSearchPayload} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/native.json.gz',import.meta.url))))
const decode=packet=>{const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256);return bytes.toString()}
const listing=fixture.responses.filter(packet=>packet.requestedURL===LISTING_API_URL),details=new Map(fixture.responses.filter(packet=>packet.requestedURL===DETAIL_API_URL).map(packet=>[JSON.parse(packet.requestBody).jobUrl,packet]))
const missing=[...details.values()].find(packet=>packet.status===404),missingSlug=JSON.parse(missing.requestBody).jobUrl
async function replay(action,edit=packet=>packet){
 const original=globalThis.fetch,reads=[],counts=new Map()
 try{
  globalThis.fetch=async(url,init)=>{
   assert.equal(init.method,'POST');assert.equal(init.headers.TenantGroupId,'G1')
   let packet,identity
   if(url===LISTING_API_URL){
    const fields=Object.fromEntries(init.body),offset=JSON.parse(fields.filterCri).paginationStartNo
    assert.deepEqual(fields,buildSearchPayload({paginationStartNo:offset}))
    const count=counts.get(offset)??0;counts.set(offset,count+1)
    packet=listing.find(packet=>packet.listingOffset===offset&&Boolean(packet.closing)===(offset===0&&count>0));identity='listing:'+offset
   }else{
    assert.equal(url,DETAIL_API_URL);const fields=JSON.parse(init.body)
    assert.deepEqual(Object.keys(fields).sort(),['campusUrl','companyId','externalSource','jobUrl']);assert.equal(fields.companyId,'15578');assert.equal(fields.externalSource,'CareerSite');assert.equal(fields.campusUrl,'empty')
    packet=details.get(fields.jobUrl);identity=fields.jobUrl
   }
   assert.ok(packet,'Only retained current declared native requests '+identity);reads.push(identity)
   const changed=edit({...packet,text:decode(packet)},identity,reads)
   return Object.defineProperty(new Response(changed.text,{status:changed.status,headers:changed.headers}),'url',{value:changed.responseURL})
  }
  return await action(reads)
 }finally{globalThis.fetch=original}
}

test('Infoedge current registered native traversal holds one observed detail404 and retains every other full India detail',()=>replay(async reads=>{
 const jobs=await run({detailConcurrency:1}),audit=jobs.nativeCollectionEvidence
 assert.equal(fixture.synthetic,false);assert.equal(reads.length,307);assert.equal(jobs.length,281)
 assert.equal(audit.observedListingCount,288);assert.equal(audit.observedIndiaListingCount,282);assert.equal(audit.returnedIndiaCount,281)
 assert.equal(audit.qualifiedIndiaCount,194);assert.equal(audit.nativeDetailQualifiedCount,194);assert.equal(audit.listingFallbackCount,0)
 assert.equal(jobs.filter(job=>!job.sourceDetailComplete).length,87)
 assert.equal(audit.heldObservations.length,1);assert.equal(audit.heldObservations[0].reason,'native-detail-unavailable-404')
 assert.equal(audit.heldObservations[0].sourceNativeListing.jobUrl,missingSlug);assert.equal(audit.heldObservations[0].httpStatus,404)
 assert.ok(!jobs.some(job=>job.sourceNativeListing.jobUrl===missingSlug))
 for(const job of jobs){
  const packet=details.get(job.sourceNativeListing.jobUrl)
  assert.equal(packet.status,200);assert.deepEqual(job.sourceNativeDetail,JSON.parse(decode(packet)))
  assert.equal(job.country,'India');assert.equal(String(job.sourceNativeDetail.companyId),'15578')
  assert.equal(job.sourceDetailComplete,Boolean(job.jobDescription));assert.equal(job.sourceListingComplete,false)
 }
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.applicationValidationQualified,false);assert.equal(audit.publicEligibility,null);assert.equal(audit.browserEquivalenceComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
}))

test('Infoedge native404 does not become an active role from its full listing preview or block another healthy detail',()=>{
 let changed=false
 return replay(async reads=>{
  const jobs=await run({maxJobs:2,detailConcurrency:1})
  assert.equal(changed,true);assert.equal(jobs.length,1);assert.equal(reads.filter(value=>!value.startsWith('listing:')).length,2)
  assert.equal(jobs.nativeCollectionEvidence.heldObservations.length,1);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 },(packet,identity)=>{
  if(!identity.startsWith('listing:')&&!changed){changed=true;return{...packet,status:404,text:decode(missing)}}return packet
 })
})

test('Infoedge an actual terminal denial keeps full listing fallbacks separate from verified detail and all authority unknown',()=>{
 let changed=false
 return replay(async reads=>{
  const jobs=await run({maxJobs:2,detailConcurrency:1}),audit=jobs.nativeCollectionEvidence
  assert.equal(changed,true);assert.equal(reads.filter(value=>!value.startsWith('listing:')).length,1)
  assert.equal(reads.filter(value=>value.startsWith('listing:')).length,24,'No additional listing request follows a terminal access denial')
  assert.equal(audit.nativeDetailQualifiedCount,0);assert.equal(audit.listingFallbackCount,jobs.length)
  assert.equal(audit.detailGaps.length,2);assert.equal(audit.detailGaps[0].httpStatus,403)
  assert.equal(audit.detailGaps[1].reason,'detail-reading-stopped-after-native-unavailability')
  assert.equal(audit.closingFirstPageMatches,null);assert.equal(audit.closingSnapshotGap.reason,'closing-native-listing-not-requested-after-access-denial')
  assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.ok(jobs.every(job=>job.sourceNativeListing&&job.sourceNativeDetail===null&&job.publicExperienceChecked===false))
 },(packet,identity)=>{
  if(identity.startsWith('listing:'))return packet;changed=true;return{...packet,status:403,text:'Controlled actual native denial'}
 })
})

test('Infoedge a redirected404 and a forged404 message remain hard errors before queued details',async()=>{
 let touched=false
 await replay(async reads=>{
  await assert.rejects(run({maxJobs:2,detailConcurrency:1}),error=>error.requestedUrl===DETAIL_API_URL&&error.responseUrl!==DETAIL_API_URL)
  assert.equal(reads.filter(value=>!value.startsWith('listing:')).length,1)
 },(packet,identity)=>{
  if(identity.startsWith('listing:'))return packet;touched=true;return{...packet,status:404,responseURL:DETAIL_API_URL+'/different-employer',text:decode(missing)}
 });assert.equal(touched,true)
 const first=JSON.parse(decode(listing[0]))
 await assert.rejects(run({maxPages:1,maxJobs:1,fetchJson:async url=>{if(url===LISTING_API_URL)return first;throw Error('HTTP 404 for detail')}}),/HTTP 404/)
})

test('Infoedge default HTTP identity checks and native full criteria remain strict around held rows',async()=>{
 for(const mode of['employer','country','description','malformed','challenge404']){
  let changed=false
  await replay(async()=>{
   await assert.rejects(run({maxJobs:1,detailConcurrency:1}));assert.equal(changed,true,mode)
  },(packet,identity)=>{
   if(identity.startsWith('listing:'))return packet;changed=true
   if(mode==='challenge404')return{...packet,status:404,headers:{...packet.headers,'cf-mitigated':'challenge'},text:'Access challenge'}
   if(mode==='malformed')return{...packet,text:'{'}
   const model=JSON.parse(packet.text)
   if(mode==='employer')model.companyId=99999
   if(mode==='country')model.country='United States'
   if(mode==='description')delete model.jobConfigurationData.Description
   return{...packet,text:JSON.stringify(model)}
  })
 }
})

test('Infoedge default native HTTP validation preserves exact caller abort reasons after a response is admitted',async()=>{
 const original=globalThis.fetch
 try{
  for(const reason of[Object.freeze({owner:'infoedge-admitted-response'}),null,undefined]){
   const caller=new AbortController();let reads=0
   globalThis.fetch=async()=>{
    reads++;caller.abort(reason)
    return Object.defineProperty(new Response(decode(listing[0]),{headers:listing[0].headers}),'url',{value:LISTING_API_URL})
   }
   await assert.rejects(run({signal:caller.signal}),error=>error===caller.signal.reason)
   assert.equal(reads,1)
  }
 }finally{globalThis.fetch=original}
})

test('Infoedge held native404 never waives the closing counted listing snapshot',()=>replay(async()=>{
 await assert.rejects(run({detailConcurrency:1}),/snapshot changed/)
},(packet,identity)=>{
 if(identity==='listing:0'&&packet.closing){const value=JSON.parse(packet.text);value.data.data[0]._source.jobTitle+=' changed';return{...packet,text:JSON.stringify(value)}}return packet
}))

test('Infoedge owns already admitted detail workers and stops queued reads after a hard identity failure',async()=>{
 const failure=Object.freeze({failureKind:'parser_or_contract_error',owner:'infoedge-hard-detail'}),first=JSON.parse(decode(listing[0]))
 let release,started,calls=0,settled=false
 const began=new Promise(resolve=>{started=resolve})
 const pending=run({maxPages:1,maxJobs:5,detailConcurrency:2,fetchJson:async(url,input)=>{
  if(url===LISTING_API_URL)return first
  calls++
  if(calls===1){await began;throw failure}
  if(calls===2){started();return new Promise(resolve=>{release=()=>resolve(JSON.parse(decode(details.get(input.json.jobUrl))))})}
  throw Error('Queued detail should not start after a fatal identity failure')
 }}).then(()=>{settled=true;return{success:true}},reason=>{settled=true;return{reason}})
 await began;await delay(0)
 try{assert.equal(settled,false,'The admitted second detail is still owned until it settles')}
 finally{release();await pending;await delay(0)}
 assert.equal((await pending).reason,failure);assert.equal(calls,2)
})
