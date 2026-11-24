import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'

const compressed=fs.readFileSync(new URL('./test-data/current-data-20261121.json.gz',import.meta.url))
assert.equal(createHash('sha256').update(compressed).digest('hex'),'a83b937b934b4f66e50af7306d96428db4aacdf610d16abd1b84133ed0d47f62')
const fixture=JSON.parse(gunzipSync(compressed)),packets=fixture.packets
const feed=JSON.parse(packets.feed.body),conflict='1b29b2e2-8fa7-431f-948d-060d8ec1fe33'
const expectedCalls=fixture.sequence.map(id=>packets[id].requestUrl)
async function replay({mutate=()=>{},options={}}={}){
 const calls=[];let audit,jobs,error
 try{jobs=await createCurrentSnowplowScraper().run({...options,fetchPage:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const entry=Object.entries(packets).find(([,packet])=>packet.requestUrl===url)
  assert(entry,'Only one of seven declared public DATA observations may be requested: '+url)
  const[id,original]=entry
  if(id==='site'||id==='feed')assert.deepEqual(init.headers,{Accept:'application/json',companyIdentifier:'snowplow'})
  assert.equal(init.headers?.Authorization,undefined);assert.equal(init.headers?.Cookie,undefined)
  const occurrence=calls.filter(value=>value===url).length+1
  calls.push(url)
  const response={...structuredClone(original),bodyComplete:true}
  await mutate(response,{id,url,occurrence,init,calls})
  return response
 },onAudit:value=>{audit=value}})}catch(caught){error=caught}
 return{jobs,error,audit,calls}
}
function held(result){
 assert.equal(result.jobs,undefined);assert(result.error)
 assert.equal(result.error.inventoryEvidence.reportedTotal,null)
 assert.equal(result.error.inventoryEvidence.indiaFacetCount,null)
 assert.equal(result.error.inventoryEvidence.listingComplete,false)
 assert.equal(result.error.nativeEvidence.cleanupAllowed,false)
}
test('current Snowplow retains all fourteen complete native DATA records and exact dates without India zero or application qualification',async()=>{
 const{jobs,error,audit,calls}=await replay()
 assert.equal(error,undefined);assert.deepEqual(calls,expectedCalls);assert.equal(calls.length,14)
 assert.equal(jobs.length,0)
 assert.deepEqual(audit.rawOpeningFeed,feed);assert.deepEqual(audit.rawClosingFeed,feed)
 assert.equal(audit.nativeInventoryCount,14);assert.equal(audit.reviewedNativeDataRecordCount,14)
 assert.equal(audit.reviewedNativeRecordCount,0);assert.equal(audit.applicationCriteriaReviewed,false)
 assert.equal(audit.nativeDataClosingReconciled,true)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.cleanupAllowed,false)
 assert(audit.gaps.includes('native-posting-country-disagreement:'+conflict))
 assert(audit.gaps.includes('current-native-renderer-complete-scope-unverified'))
 assert(audit.gaps.includes('current-native-application-criteria-unreviewed'))
 const facts=audit.nativeDataObservations
 assert.equal(facts.length,14)
 for(const original of feed.jobAdDetails){
  const observed=facts.find(row=>row.jobId===original.id)
  assert.deepEqual(observed.rawNativeRecord,original)
  assert.equal(observed.publishedAt,original.publishedAt)
  assert.equal(observed.validThrough,original.validThrough)
  assert.equal(observed.closingDate,original.closingDate)
  assert.equal(observed.sourceDetailComplete,false)
  assert.equal(observed.applicationCriteriaReviewed,false)
 }
 const disputed=facts.find(row=>row.jobId===conflict)
 assert.deepEqual(disputed.countryCodes,['GB','US']);assert.equal(disputed.countryDisagreement,true)
 assert.equal(facts.find(row=>row.rawNativeRecord.country==='Colombia').countryCode,'CO')
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,14)
})
test('a jobs cap preserves all native DATA observations and all seven closing pairs',async()=>{
 const{error,audit,calls}=await replay({options:{maxJobs:1}})
 assert.equal(error,undefined);assert.equal(audit.nativeInventoryCount,14);assert.deepEqual(calls,expectedCalls)
})
for(const[name,target,occurrence,change]of[
 ['unknown native main','main',1,p=>{p.body+=';window.unreviewed=true'}],
 ['changed closing main','main',2,p=>{p.body+=';window.unreviewed=true'}],
 ['changed native runtime','runtime',1,p=>{p.body+=';window.unreviewed=true'}],
 ['changed public route service','routes',1,p=>{p.body=p.body.replace('"/api/job-ad"','"/api/internal-job-ad"')}],
 ['changed closing route service','routes',2,p=>{p.body+=';window.unreviewed=true'}],
 ['mixed closing native entry','entry',2,p=>{p.body=p.body.replaceAll('master-2362346a37b8f119f2e8fb84c7df43797609ce02','master-3c66a8510a89e6183130fae020cf4ffdecc6d103')}],
 ['unknown closing native security policy','entry',2,p=>{p.headers['content-security-policy']+=" connect-src https://unreviewed.invalid;"}],
 ['unpublished native employer','site',1,p=>{const data=JSON.parse(p.body);data.isPublished=false;p.body=JSON.stringify(data)}],
 ['foreign native employer','site',1,p=>{const data=JSON.parse(p.body);data.companyName='Other publisher';p.body=JSON.stringify(data)}],
 ['new closing employer authority','site',2,p=>{const data=JSON.parse(p.body);data.sections[0].data.jobListingMenuTitle='Only residents may apply';p.body=JSON.stringify(data)}],
 ['changed mandatory closing criteria','feed',2,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].description+='<p>Must hold additional clearance.</p>';p.body=JSON.stringify(data)}],
 ['changed closing country cannot resurrect an India record','feed',2,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].country='India';p.body=JSON.stringify(data)}],
 ['unknown native country','feed',1,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].country='Unreviewed country';p.body=JSON.stringify(data)}],
 ['hidden native location','feed',1,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].hideLocationInformation=true;p.body=JSON.stringify(data)}],
 ['hidden native criterion','feed',1,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].description+='<p hidden>Mandatory residency.</p>';p.body=JSON.stringify(data)}],
 ['missing closing vacancy','feed',2,p=>{const data=JSON.parse(p.body);data.jobAdDetails.pop();p.body=JSON.stringify(data)}],
 ['duplicate native identity','feed',1,p=>{const data=JSON.parse(p.body);data.jobAdDetails[1].id=data.jobAdDetails[0].id;p.body=JSON.stringify(data)}],
 ['invented publication date','feed',1,p=>{const data=JSON.parse(p.body);data.jobAdDetails[0].publishedAt='2026-02-30T12:00:00Z';p.body=JSON.stringify(data)}],
 ['unknown closing corporate policy','corporate',2,p=>{p.body=p.body.replace('</head>','<style>#rlist{display:none}</style></head>')}],
 ['native redirect identity','feed',1,p=>{p.url='https://other.careers.hibob.com/api/job-ad'}],
 ['native MIME drift','feed',1,p=>{p.contentType='text/html'}],
])test('current Snowplow holds '+name,async()=>{
 let touched=false
 const result=await replay({mutate:(packet,at)=>{if(at.id===target&&at.occurrence===occurrence){touched=true;change(packet)}}})
 assert.equal(touched,true,'The negative must reach the targeted original response')
 held(result);assert(result.calls.length<=14)
 if(occurrence===2&&target==='feed')assert.equal(result.error.nativeEvidence.nativeDataClosingReconciled,false)
})
test('a public API denial stops immediately with unavailable counts and original response evidence',async()=>{
 let touched=false
 const result=await replay({mutate:(packet,at)=>{if(at.id==='site'){touched=true;packet.status=403;packet.body='Denied'}}})
 assert.equal(touched,true);held(result)
 assert.equal(result.calls.length,6);assert.equal(result.error.status,403)
 assert.equal(result.error.failureKind,'blocked_or_access_denied')
 assert.equal(result.error.retainedNativeResponses.at(-1).response.body,'Denied')
})
test('an unavailable closing feed retains every opening fact as incomplete DATA evidence',async()=>{
 const result=await replay({mutate:(packet,at)=>{if(at.id==='feed'&&at.occurrence===2){packet.status=503;packet.body='Temporarily unavailable'}}})
 held(result);assert.equal(result.calls.length,14)
 const evidence=result.error.nativeEvidence
 assert.deepEqual(evidence.rawOpeningFeed,feed)
 assert.equal(evidence.nativeInventoryCount,14);assert.equal(evidence.nativeDataObservations.length,14)
 assert.equal(evidence.rawClosingFeed,null);assert.equal(evidence.nativeDataClosingReconciled,false)
 assert.equal(evidence.reviewedNativeDataRecordCount,0)
 assert(evidence.nativeDataObservations.every(row=>row.sourceDetailComplete===false&&row.nativeDataClosingReconciled===false))
})
test('a current one-page-short budget stops after publisher identification',async()=>{
 const result=await replay({options:{maxPages:13}})
 held(result);assert.equal(result.error.code,'SNOWPLOW_PAGE_BUDGET');assert.equal(result.calls.length,1)
})
test('caller supplied profiles cannot admit unknown corporate authority',async()=>{
 const result=await replay({options:{reviewedProfile:{corporateBodySha256:'anything',sourceScopeComplete:true}},mutate:(packet,at)=>{if(at.id==='corporate')packet.body+='\n'}})
 held(result);assert.equal(result.calls.length,1)
})
for(const[label,reason]of[['null',null],['frozen object',Object.freeze({caller:'Snowplow current DATA'})],['Error',Error('Snowplow caller cancellation')]]){
 test('current DATA preserves an already cancelled '+label,async()=>{
  const controller=new AbortController();controller.abort(reason)
  const result=await replay({options:{signal:controller.signal}})
  assert.equal(result.error,reason);assert.equal(result.calls.length,0)
 })
 test('current DATA preserves caller '+label+' during a native read',async()=>{
  const controller=new AbortController();let touched=false
  const result=await replay({options:{signal:controller.signal},mutate:(_,at)=>{if(at.id==='feed'){touched=true;controller.abort(reason)}}})
  assert.equal(touched,true);assert.equal(result.error,reason);assert.equal(result.calls.length,7)
 })
}
test('an injected read that ignores abort still stops at the local deadline',async()=>{
 let signal,touched=false
 const result=await replay({options:{readTimeoutMs:25},mutate:(_,at)=>{if(at.id==='entry'){touched=true;signal=at.init.signal;return new Promise(()=>{})}}})
 assert.equal(touched,true);held(result);assert.equal(result.error.code,'SNOWPLOW_READ_TIMEOUT')
 assert.equal(signal.aborted,true);assert.equal(result.calls.length,2)
})
