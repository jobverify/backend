import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCurrentSnowplowScraper} from './currentNative.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

const read=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name,import.meta.url))))
const native=read('native-cohort-20261109-evening.json.gz'),assets=read('declared-build-20261109.json.gz'),archive=read('current-native-20261106-evening.json.gz')
const assetMap=new Map(assets.packets.map(packet=>[packet.requestedURL,packet])),archiveMap=new Map(archive.packets.map(packet=>[packet.requestUrl,packet]))
const board='https://snowplow.careers.hibob.com/',feed=board+'api/job-ad',id='724ab4ae-e09e-4fd3-a412-ac834b6c81db'
const form=board+'api/job-ad/'+id+'/application-form',description='/jobAd/descriptionId./jobDescription/description'
const edit=(response,change)=>{const data=JSON.parse(response.body);change(data);response.body=JSON.stringify(data)}
const replay=async mutate=>{
 const calls=[]
 let audit
 const jobs=await createCurrentSnowplowScraper().run({onAudit:value=>{audit=value},fetchPage:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const originalUrl=url.replace('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id)
  const matches=native.packets.filter(packet=>packet.url===originalUrl),at=calls.filter(value=>value===url).length
  const packet=matches.length?matches[Math.min(at,matches.length-1)].response:assetMap.get(url)||archiveMap.get(url)
  assert.ok(packet,'Original captured endpoint: '+url)
  const response={status:packet.status,url:packet.url===originalUrl?url:packet.url,contentType:packet.contentType,body:packet.body,bodyComplete:packet.bodyComplete??true}
  mutate(response,url,calls)
  calls.push(url)
  return response
 }})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}
function assertPartial({jobs,audit,evidence},observed,reviewed,unreviewed){
 assert.equal(jobs.length,0)
 assert.equal(audit.nativeInventoryCount,observed)
 assert.equal(audit.reviewedNativeRecordCount,reviewed)
 assert.equal(audit.unreviewedNativeRecordCount,unreviewed)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.cleanupAllowed,false)
 assert.equal(evidence.status,'discovery-only')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(readSourceObservationEvidence(jobs,'snowplow').observedRecordCount,observed)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:evidence}),{replaceExisting:false})
}

test('ordinary full native description copy edit is retained as unqualified partial observations',async()=>{
 const copy='<p>We offer flexible working hours.</p>'
 const result=await replay((response,url)=>{
  if(url===feed)edit(response,p=>{p.jobAdDetails.find(row=>row.id===id).description+=copy})
  if(url===form)edit(response,p=>{p.data.jobAd.jobDescription[description].value+=copy})
 })
 assertPartial(result,10,9,1)
 assert.match(result.audit.rawOpeningFeed.jobAdDetails.find(row=>row.id===id).description,/We offer flexible working hours/)
 assert.match(result.audit.rawClosingFeed.jobAdDetails.find(row=>row.id===id).description,/We offer flexible working hours/)
 const proof=result.audit.detailProofs.find(row=>row.jobId===id)
 assert.match(proof.rawOpening.data.jobAd.jobDescription[description].value,/We offer flexible working hours/)
 assert.match(proof.rawClosing.data.jobAd.jobDescription[description].value,/We offer flexible working hours/)
 assert.equal(proof.criteriaReviewed,false)
 assert.match(result.audit.gaps.join(';'),/unreviewed-complete-native-role-criteria:/)
})

test('legitimate closed role and its unused department filter recover nine observations without cleanup',async()=>{
 const removed='2ca301b1-a31a-44e6-99be-3b26931c0864'
 const result=await replay((response,url)=>{if(url===feed)edit(response,p=>{
  p.jobAdDetails=p.jobAdDetails.filter(row=>row.id!==removed)
  p.filterGroups.departments=p.filterGroups.departments.filter(item=>item.serverId!=='256613055')
 })})
 assertPartial(result,9,9,0)
 assert.equal(result.audit.rawOpeningFeed.jobAdDetails.length,9)
 assert.equal(result.audit.rawClosingFeed.jobAdDetails.length,9)
 assert.equal(result.audit.detailProofs.length,9)
 assert.equal(result.calls.some(url=>url.includes('/'+removed+'/')),false)
 assert.match(result.audit.gaps.join(';'),/unreviewed-native-filter-values|unreviewed-complete-native-feed-cohort/)
})

test('new well-formed mandatory form question retains complete questions without qualifying the changed record',async()=>{
 const question='Describe the workflow you would automate first.'
 const result=await replay((response,url)=>{if(url===form)edit(response,p=>{
  const values=p.data.jobAd.applicationForm['/applicationForm/questions'].value
  const added=structuredClone(values[0])
  added.id=67775337
  added['/applicationFormQuestion/ordinal'].value=1
  added['/question/text'].value=question
  values.push(added)
 })})
 assertPartial(result,10,9,1)
 const proof=result.audit.detailProofs.find(row=>row.jobId===id)
 for(const payload of [proof.rawOpening,proof.rawClosing]){
  const questions=payload.data.jobAd.applicationForm['/applicationForm/questions'].value
  assert.equal(questions.length,2)
  assert.equal(questions[1]['/question/text'].value,question)
  assert.equal(questions[1]['/question/isMandatory'].value,true)
 }
 assert.equal(proof.criteriaReviewed,false)
 assert.match(result.audit.gaps.join(';'),/unreviewed-application-mandatory-fields-questions:/)
})

test('new well-formed native role is retained without a cohort whitelist or eligibility proof',async()=>{
 const addedId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 const result=await replay((response,url)=>{if(url===feed)edit(response,p=>{
  const added=structuredClone(p.jobAdDetails.find(row=>row.id===id))
  added.id=addedId
  p.jobAdDetails.push(added)
 })})
 assertPartial(result,11,10,1)
 const proof=result.audit.detailProofs.find(value=>value.jobId===addedId)
 assert.ok(proof.rawOpening&&proof.rawClosing)
 assert.equal(proof.criteriaReviewed,false)
 assert.ok(result.audit.rawOpeningFeed.jobAdDetails.some(row=>row.id===addedId))
 assert.ok(result.audit.rawClosingFeed.jobAdDetails.some(row=>row.id===addedId))
})

test('all legitimate roles closing retains an observed empty native packet with unknown company totals',async()=>{
 const result=await replay((response,url)=>{if(url===feed)edit(response,p=>{
  p.jobAdDetails=[]
  for(const group of Object.values(p.filterGroups))group.splice(0)
 })})
 assertPartial(result,0,0,0)
 assert.equal(result.audit.detailProofs.length,0)
 assert.equal(result.calls.some(url=>url.endsWith('/application-form')),false)
})

test('closing role removal retains both cohorts and removes the missing second proof from reviewed counts',async()=>{
 const removed='2ca301b1-a31a-44e6-99be-3b26931c0864'
 const result=await replay((response,url,calls)=>{if(url===feed&&calls.includes(feed))edit(response,p=>{
  p.jobAdDetails=p.jobAdDetails.filter(row=>row.id!==removed)
  p.filterGroups.departments=p.filterGroups.departments.filter(item=>item.serverId!=='256613055')
 })})
 assertPartial(result,10,9,1)
 assert.equal(result.audit.openingNativeInventoryCount,10)
 assert.equal(result.audit.closingNativeInventoryCount,9)
 assert.ok(result.audit.rawObservedFeeds.some(value=>value.jobAdDetails.length===10))
 assert.ok(result.audit.rawObservedFeeds.some(value=>value.jobAdDetails.length===9))
 const proof=result.audit.detailProofs.find(value=>value.jobId===removed)
 assert.equal(proof.criteriaReviewed,false)
 assert.equal(proof.rawClosing,null)
 assert.match(result.audit.gaps.join(';'),/native-role-not-present-in-both-passes:/)
})

test('closing ordinary form copy drift retains both complete answers schemas and quarantines only the changed record',async()=>{
 const result=await replay((response,url,calls)=>{if(url===form&&calls.includes(form))edit(response,p=>{
  p.data.jobAd.applicationForm['/applicationForm/questions'].value[0]['/question/text'].value='Describe a project that improved a team workflow.'
 })})
 assertPartial(result,10,9,1)
 const proof=result.audit.detailProofs.find(value=>value.jobId===id)
 assert.notEqual(proof.rawOpening.data.jobAd.applicationForm['/applicationForm/questions'].value[0]['/question/text'].value,
  proof.rawClosing.data.jobAd.applicationForm['/applicationForm/questions'].value[0]['/question/text'].value)
 assert.equal(proof.criteriaReviewed,false)
 assert.match(result.audit.gaps.join(';'),/full raw closing application criteria changed:/)
})

test('a public404 for a closed native application preserves all row observations without qualification',async()=>{
 const result=await replay((response,url)=>{if(url===form){response.status=404;response.body=null;response.bodyComplete=false}})
 assertPartial(result,10,9,1)
 const proof=result.audit.detailProofs.find(value=>value.jobId===id)
 assert.equal(proof.rawOpening,null);assert.equal(proof.rawClosing,null)
 assert.ok(result.audit.receipts.some(packet=>packet.url===form&&packet.response.status===404))
 assert.match(result.audit.gaps.join(';'),/native-application-unavailable:/)
})

for(const[label,change,reason]of[
 ['unknown native country',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].country='Worldwide'})},/unresolved typed native country/],
 ['unknown alternate country',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].postingLocations[0].country='Worldwide'})},/unresolved typed native posting country/],
 ['additional row schema',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].unknownMandatoryCriterion=true})},/native role fields/],
 ['malformed UUID',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].id='../other-tenant'})},/native role identity/],
 ['duplicate role identity',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails.push(p.jobAdDetails[0])})},/duplicate native role identity/],
 ['new posting-location schema',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].postingLocations[0].unknownCriterion=true})},/posting location alternatives schema/],
 ['wrong feed MIME',(r,url)=>{if(url===feed)r.contentType='text/plain'},/native feed MIME/],
 ['wrong application MIME',(r,url)=>{if(url===form)r.contentType='text/plain'},/MIME/],
 ['wrong application title identity',(r,url)=>{if(url===form)edit(r,p=>{p.data.jobAd.title='Different posting'})},/role\/application identity conflict/],
 ['wrong application country identity',(r,url)=>{if(url===form)edit(r,p=>{p.data.jobAd.site='Bengaluru, India'})},/role\/application identity conflict/],
 ['wrong form field parent identity',(r,url)=>{if(url===form)edit(r,p=>{p.data.jobAd.applicationForm['/applicationForm/fields'].value[0]['/applicationFormField/applicationFormId'].value++})},/field schema or identity/],
 ['malformed new mandatory question',(r,url)=>{if(url===form)edit(r,p=>{p.data.jobAd.applicationForm['/applicationForm/questions'].value.push({isMandatory:true,text:'Required'})})},/fields\/questions schema/],
 ['unknown nested application metadata',(r,url)=>{if(url===form)edit(r,p=>{p.metadata.unknownRequiredCriterion=true})},/nested application metadata/],
 ['unknown opening schema',(r,url)=>{if(url===feed)edit(r,p=>{p.jobOpeningMetadata[0].unknownCriterion=true})},/filter\/opening metadata/],
 ['unknown pagination schema',(r,url)=>{if(url===feed)edit(r,p=>{p.nextPage='other'})},/feed envelope schema/],
 ['numeric precision loss',(r,url)=>{if(url===feed)r.body=r.body.replace(/("siteId":\s*)2470142/,(_,prefix)=>prefix+'2470142.00000000000000001')},/numeric precision loss/],
 ['hidden role criteria',(r,url)=>{if(url===feed)edit(r,p=>{p.jobAdDetails[0].description+='<div style="display:none">Additional criterion</div>'})},/hidden or incomplete role criteria/],
 ['changed current site configuration',(r,url)=>{if(url===board+'api/career-site')edit(r,p=>{p.companyName='Different employer'})},/site configuration or scope/],
 ['changed declared renderer',(r,url)=>{if(url.includes('/3213.'))r.body+=';unreviewedProgram()'},/renderer\/style\/program/],
])test('dynamic recovery preserves rejection of '+label,async()=>{
 await assert.rejects(replay(change),error=>{
  assert.match(error.message,reason)
  assert.equal(classifyScraperError(error).softFailure,false)
  assert.equal(error.sourceScopeComplete,false)
  assert.equal(error.sourceListingComplete,false)
  assert.equal(error.inventoryEvidence.listingComplete,false)
  assert.equal(error.inventoryEvidence.reportedTotal,null)
  assert.equal(error.inventoryEvidence.indiaFacetCount,null)
  assert.ok(error.retainedNativeResponses.length>0)
  return true
 })
})
