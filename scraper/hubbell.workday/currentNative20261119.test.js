import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261119.json.gz',import.meta.url))))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
async function replay(mutate=packet=>packet){
 const originalFetch=globalThis.fetch;let reads=0
 globalThis.fetch=async(url,init)=>{
  const original=fixture.packets[reads++];assert.ok(original,'Only original public capture requests')
  assert.equal(url,original.url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
  const bytes=Buffer.from(original.bodyBase64,'base64');assert.equal(hash(bytes),original.bodySHA256)
  const packet=mutate({...original,body:bytes.toString('utf8')},reads)
  const response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalURL});return response
 }
 try{return{jobs:await run({now:fixture.startedAt}),reads}}finally{globalThis.fetch=originalFetch}
}

test('current unchanged Hubbell reconciles639 native rows and18 full India roles without certifying company completeness',async()=>{
 const{jobs,reads}=await replay(),proof=readInventoryEvidence(jobs)
 assert.equal(reads,85);assert.equal(jobs.length,18)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.nativeDescriptionHTML.length>500
  &&job.nativeMicrodata.hiringOrganization==='Hubbell Incorporated'))
 assert.equal(proof.reportedTotal,639);assert.equal(proof.pagesFetched,22)
 assert.equal(proof.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'hubbell',companyName:'Hubbell'},jobs)
 assert.equal(assessment.indiaJobs,18);assert.equal(assessment.eligibleJobs,15)
 assert.equal(assessment.filterCounts.excludedTitle,3)
 assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('Hubbell still rejects a different total on a later current native page',async()=>{
 await assert.rejects(()=>replay((packet,index)=>index===5?{...packet,body:packet.body.replaceAll('of <b>639</b>','of <b>640</b>')}:packet),/total|range/i)
})

test('Hubbell still rejects closing first-page membership drift',async()=>{
 await assert.rejects(()=>replay((packet,index)=>index===fixture.packets.length?{...packet,body:packet.body.replaceAll('Marketing Communications Performance Analyst','Unrelated new role title')}:packet),/inventory changed/i)
})
