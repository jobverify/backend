import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
async function replay(mutate=packet=>packet){
 let reads=0;const counts=new Map()
 const jobs=await run({sourceTimeoutMs:60000,maxRequests:128,maxDetails:80,maxPages:8,fetchImpl:async(url,init)=>{
  const original=fixture.packets[reads++];assert.ok(original,'Only captured current declared public requests')
  assert.equal(String(url),original.url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  const raw=Buffer.from(original.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(raw).digest('hex'),original.bodySHA256)
  const occurrence=(counts.get(original.url)||0)+1;counts.set(original.url,occurrence)
  const packet=mutate({...original,body:raw.toString('utf8')},occurrence)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }})
 return{jobs,reads}
}

test('unchanged current onsemi retains34 full India roles after exact independent closing reconciliation',async()=>{
 const{jobs,reads}=await replay(),proof=readInventoryEvidence(jobs)
 assert.equal(reads,83);assert.equal(jobs.length,34)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceNativeClosingEvidence.inventoryRechecked))
 const observations=jobs[Symbol.for('jobverify.verified-recruitment-observations')]
 assert.equal(observations.nativeRecords,35)
 assert.equal(observations.onsemiHeldRoles.length,0)
 assert.equal(proof.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'onsemiconductor',companyName:'ON Semiconductor'},jobs)
 assert.equal(assessment.indiaJobs,34);assert.equal(assessment.eligibleJobs,28)
 assert.equal(assessment.filterCounts.old,5);assert.equal(assessment.filterCounts.excludedTitle,1)
 assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('onsemi still rejects a changed current closing listing identity',async()=>{
 await assert.rejects(()=>replay((packet,count)=>{
  if(count!==2||!packet.url.includes('findReqs;'))return packet
  const model=JSON.parse(packet.body);model.items[0].requisitionList[0].Title+=' unreviewed title'
  return{...packet,body:JSON.stringify(model)}
 }),error=>/closing inventory changed/.test(error.message)&&error.recruitmentObservations.nativeRecords===35)
})

test('onsemi still rejects changed current own closing qualifications',async()=>{
 await assert.rejects(()=>replay((packet,count)=>{
  if(count!==2||!packet.url.includes('Id=%222506716%22'))return packet
  const model=JSON.parse(packet.body);model.items[0].ExternalQualificationsStr+='<p>Additional required qualification.</p>'
  return{...packet,body:JSON.stringify(model)}
 }),/closing own criteria or identity changed/)
})
