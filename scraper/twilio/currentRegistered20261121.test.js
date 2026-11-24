import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {channel} from 'node:diagnostics_channel'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-registered-20261121.json.gz',import.meta.url))))
const source=fixture.source,success=['twilio','celebaltechnologies'].includes(source)
test(source+' registered current originals retain complete native roles or the first exact public denial',async t=>{
 const calls=[],counts=new Map();let physical=0
 const topic=channel('undici:request:create'),count=()=>physical++;topic.subscribe(count)
 const fetchImpl=async value=>{
  const url=String(value),index=counts.get(url)??0;counts.set(url,index+1);calls.push(url)
  const packet=fixture.packets.filter(packet=>packet.url===url)[index]
  assert.ok(packet,'Only the actual complete original response sequence may be read: '+url+' #'+index)
  const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
  return Object.defineProperty(new Response(bytes,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }
 t.mock.method(globalThis,'fetch',fetchImpl)
 let jobs,error
 try{const provider=getScraperCatalog().find(row=>row.source===source);assert.ok(provider.modulePath.replaceAll('\\','/').endsWith('/scraper/'+source+'/script.js'));jobs=await createCatalogScraper(provider).run({fetchImpl,now:()=>fixture.capturedAt,requestIntervalMs:0})}catch(caught){error=caught}finally{topic.unsubscribe(count)}
 assert.equal(physical,0);assert.equal(calls.length,fixture.packets.length)
 if(!success){
  assert.equal(error?.httpStatus,403);assert.equal(error.failureKind,'blocked_or_access_denied');assert.equal(error.abortRetries,true);assert.equal(error.sourceScopeComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(calls.filter(url=>url.includes('/ms/candidateapi/')).length,1);assert.equal(calls.at(-1),fixture.packets.at(-1).url)
  return
 }
 assert.ifError(error)
 const expected=source==='twilio'?{jobs:9,eligible:9,observed:15}:{jobs:6,eligible:1,observed:30}
 const analysis=analyzePublishableJobs(jobs,{now:new Date(fixture.capturedAt)})
 assert.equal(jobs.length,expected.jobs);assert.equal(analysis.indiaJobs.length,expected.jobs);assert.equal(analysis.eligibleJobs.length,expected.eligible)
 assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,expected.observed)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  const raw=source==='twilio'?job.nativeSourceRecord.originalNativeRole:job.sourceNativeRecord
  const packet=fixture.packets.find(packet=>source==='twilio'?packet.url.includes('position_id='+raw.id+'&'):packet.url.endsWith('/getJob/'+raw.id))
  const original=JSON.parse(Buffer.from(packet.bodyBase64,'base64')).data;assert.deepEqual(raw,original)
  if(source==='twilio'){
   assert.equal(job.company,'Twilio');assert.ok(job.jobDescription.startsWith(original.jobDescription+'\n'));assert.equal(job.sourceNativeClosingReconciled,true)
   assert.equal(job.postingDate,null);assert.equal(job.closingDate,null);assert.deepEqual(job.nativeSourceRecord.originalDateEvidence.nativeCustomPostDateLiteral,original.efcustomTextPostDate)
   assert.equal(job.nativeSourceRecord.originalDateEvidence.nativePostedTs,original.postedTs)
  }else{
   assert.equal(job.company,'Celebal Technologies');assert.equal(job.postingDate,original.createdAt);assert.equal(job.sourceListingComplete,false)
  }
 }
 if(source==='twilio')assert.ok(jobs.nativeCollectionEvidence.holds.some(hold=>hold.reason.includes('detail-budget')))
 else{assert.equal(jobs.nativeCollectionEvidence.candidateRoles,24);assert.equal(jobs.nativeCollectionEvidence.rawNativeRecords,30);assert.equal(jobs.nativeCollectionEvidence.unknownCountry.length,18);assert.deepEqual(jobs.nativeCollectionEvidence.criteriaHolds,[])}
})
