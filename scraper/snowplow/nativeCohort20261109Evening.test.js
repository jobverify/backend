import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name,import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const nativeBytes=fs.readFileSync(new URL('./test-data/native-cohort-20261109-evening.json.gz',import.meta.url))
assert.equal(sha(nativeBytes),'15f73b213c984830831eeeb1c054d0544bd850c4b155ce8ca2f3f117f8f6711f')
const native=JSON.parse(gunzipSync(nativeBytes))
const assets=read('declared-build-20261109.json.gz')
const archive=read('current-native-20261106-evening.json.gz')
const assetMap=new Map(assets.packets.map(packet=>[packet.requestedURL,packet]))
const archiveMap=new Map(archive.packets.map(packet=>[packet.requestUrl,packet]))
const corporate='https://snowplow.io/careers',board='https://snowplow.careers.hibob.com/',feed=board+'api/job-ad'
const conflictId='1b29b2e2-8fa7-431f-948d-060d8ec1fe33'
const replacements=['724ab4ae-e09e-4fd3-a412-ac834b6c81db','ba971356-78ac-4710-86ac-1383cdd75a06',conflictId]
const expectedLocation={sourceType:'site',locationId:2470142,name:'Massachusetts',country:'United States',region:'Massachusetts',city:null,displayFormat:'name',displayValue:'Massachusetts',showCity:true,showRegion:true}

// These are original current native packets. The separately captured same-build
// resources and retained external style are explicit replay controls; only the
// fresh default public run can prove they still respond with reviewed bytes.
async function replay(mutate=()=>{},options={}){
 const calls=[]
 let audit
 const jobs=await createCurrentSnowplowScraper().run({onAudit:value=>{audit=value},fetchPage:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  if(url.startsWith(board+'api/'))assert.equal(init.headers.companyIdentifier,'snowplow')
  const matches=native.packets.filter(packet=>packet.url===url)
  const occurrence=calls.filter(value=>value===url).length
  const packet=matches.length?matches[Math.min(occurrence,matches.length-1)].response:assetMap.get(url)||archiveMap.get(url)
  assert.ok(packet,'Only original captured endpoint: '+url)
  const response={status:packet.status,url:packet.url,contentType:packet.contentType,body:packet.body,bodyComplete:packet.bodyComplete??true}
  mutate(response,url,calls)
  calls.push(url)
  return response
 },...options})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}
const editJSON=(response,change)=>{const payload=JSON.parse(response.body);change(payload);response.body=JSON.stringify(payload)}

test('reviewed current ten-role cohort preserves new full criteria and conflicting original geography without certifying India zero',async()=>{
 const{jobs,audit,calls,evidence}=await replay()
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,10)
 assert.deepEqual(audit.canonicalCountryCounts,{US:4,GB:6})
 assert.equal(audit.detailProofs.length,10)
 assert.ok(audit.detailProofs.every(proof=>proof.rawOpening&&proof.rawClosing))
 assert.deepEqual(audit.rawOpeningFeed,audit.rawClosingFeed)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,10)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.cleanupAllowed,false)
 const conflict=audit.countryProofs.find(row=>row.jobId===conflictId)
 assert.equal(conflict.rawCountry,'United Kingdom')
 assert.equal(conflict.countryCode,'GB')
 assert.deepEqual(conflict.rawPostingLocations,[expectedLocation])
 assert.deepEqual(conflict.countryCodes,['GB','US'])
 assert.equal(conflict.countryDisagreement,true)
 assert.ok(audit.gaps.includes('native-posting-country-disagreement:'+conflictId))
 assert.match(audit.gaps.join(';'),/corporate\/native inventory identity mismatch/)
 assert.match(audit.gaps.join(';'),/unreconciled-native-role-reference/)
 assert.match(audit.gaps.join(';'),/unreviewed-declared-stylesheet/)
 for(const id of replacements){
  const proof=audit.detailProofs.find(value=>value.jobId===id)
  const form=proof.rawOpening.data.jobAd.applicationForm
  assert.equal(form['/applicationForm/questions'].value.length,1)
  assert.equal(form['/applicationForm/questions'].value[0]['/question/isMandatory'].value,true)
  assert.ok(form['/applicationForm/fields'].value.some(field=>field['/applicationFormField/fieldPath'].value==='/application/desiredSalary'))
  assert.deepEqual(proof.rawOpening.data.jobAd.postingLocations,[expectedLocation])
 }
 assert.equal(evidence.status,'discovery-only')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
 assert.ok(calls.filter(url=>url.includes('master-ca5a2f0db82396c349fbcfb3addf624abaeca12b')).length>=184)
})

for(const[label,mutate,reason,validContentChange=false]of[
 ['unreviewed native India posting alternative',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails[0].postingLocations[0].country='India'})},/posting location alternatives|complete native role criteria/],
 ['unknown alternate country',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails[2].postingLocations[0].country='Unknown'})},/unresolved typed native posting country/],
 ['removed conflicting alternate geography',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails[2].postingLocations=[]})},/posting location alternatives|complete native role criteria/],
 ['new location on previously reviewed role',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails[3].postingLocations=[{country:'India'}]})},/posting location alternatives/],
 ['changed complete role description',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails[0].description+='<p>India residence is mandatory.</p>'})},/unreviewed-complete-native-role-criteria:/,true],
 ['missing native role within unchanged filter scope',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobAdDetails.pop()})},/unreviewed-complete-native-feed-cohort/,true],
 ['additional known native country filter',(r,url)=>{if(url===feed)editJSON(r,p=>{p.filterGroups.countries.push({serverId:'India',value:'India'})})},/unreviewed-native-filter-values/,true],
 ['new native opening scope',(r,url)=>{if(url===feed)editJSON(r,p=>{p.jobOpeningMetadata[0].unknownMandatoryCriterion=true})},/filter\/opening metadata/],
 ['new application mandatory question',(r,url)=>{if(url.endsWith('/'+replacements[0]+'/application-form'))editJSON(r,p=>{p.data.jobAd.applicationForm['/applicationForm/questions'].value[0]['/question/text'].value+=' Mandatory India license.'})},/unreviewed-application-mandatory-fields-questions:/,true],
 ['application alternate location mismatch',(r,url)=>{if(url.endsWith('/'+conflictId+'/application-form'))editJSON(r,p=>{p.data.jobAd.postingLocations=[]})},/application posting location alternatives/],
 ['closing salary requirement change',(r,url,calls)=>{if(url.endsWith('/'+replacements[1]+'/application-form')&&calls.includes(url))editJSON(r,p=>{p.data.jobAd.applicationForm['/applicationForm/fields'].value[3]['/applicationFormField/isMandatory'].value=false})},/unreviewed-application-mandatory-fields-questions:/,true],
 ['changed declared lazy program',(r,url)=>{if(url.includes('/3213.'))r.body+=';unknownHiringControl()'},/renderer\/style\/program changed/],
])test('current ten-role cohort holds '+label+' and retains original evidence',async()=>{
 if(validContentChange){
  const{jobs,audit,evidence}=await replay(mutate)
  assert.equal(jobs.length,0)
  assert.match(audit.gaps.join(';'),reason)
  assert.equal(audit.nativeInventoryCount,label.startsWith('missing native role')?9:10)
  assert.equal(audit.sourceScopeComplete,false)
  assert.equal(audit.cleanupAllowed,false)
  assert.equal(evidence.status,'discovery-only')
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.ok(audit.rawOpeningFeed&&audit.rawClosingFeed)
  assert.ok(audit.detailProofs.every(proof=>proof.rawOpening&&proof.rawClosing))
  assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
  return
 }
 await assert.rejects(replay(mutate),error=>{
  assert.match(error.message,reason)
  assert.equal(classifyScraperError(error).softFailure,false)
  assert.equal(error.softFailure,undefined)
  assert.equal(error.nativeEvidence.sourceScopeComplete,false)
  assert.equal(error.nativeEvidence.cleanupAllowed,false)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.ok(error.retainedNativeResponses.length>=4)
  return true
 })
})
