import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,JOBS_SEARCH_URL,extractJsonpPayload} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/blank-application-20261117.json.gz',import.meta.url))))
const previous=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261116.json.gz',import.meta.url))))
const text=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const api=current.requests.find(packet=>packet.requestedURL.startsWith('https://jobsapi-internal.'))
const originalPayload=extractJsonpPayload(text(api))
// Current original API/publication is paired here with retained complete own
// details for compatibility. A separate default capture verifies live acquisition.
const replay=async(allBlank=false)=>{
 const payload=structuredClone(originalPayload)
 if(allBlank)for(const row of payload.queryResult)row.seo_url=''
 const requests=[]
 const read=async url=>{
  requests.push(url)
  if(url.startsWith('https://jobsapi-internal.'))return 'jobverifyAllstateCallback('+JSON.stringify(payload)+')'
  const packet=url===JOBS_SEARCH_URL?current.requests[0]:previous.originals.find(packet=>packet.url===url)
  assert.ok(packet,'Only declared original Allstate source: '+url)
  assert.equal(packet.status,200)
  return text(packet)
 }
 return {jobs:await run({fetchText:read,fetchJsonpText:read}),requests}
}

test('Allstate current blank application rows are retained as holds while eight qualified native roles survive',async()=>{
 const {jobs,requests}=await replay()
 assert.equal(jobs.length,8)
 assert.ok(!jobs.some(job=>['R36346','R36582'].includes(job.jobId)))
 assert.ok(jobs.every(job=>job.applyUrl&&job.sourceDetailComplete&&job.lifecycleCleanupAllowed===false))
 assert.equal(requests.length,12)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.closingRawRowsMatch,true)
 assert.deepEqual(jobs.nativeCollectionEvidence.heldNativeRecords.map(row=>row.nativeRecord.ref),['R36346','R36582'])
 const assessed=assessSoftFailureAcquisition({source:'allstate',companyName:'Allstate'},jobs)
 assert.equal(assessed.runnerOutcome.rawRecords,10)
 assert.equal(assessed.indiaJobs,8)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Allstate all-blank application observations never authorize verified empty inventory',async()=>{
 const {jobs,requests}=await replay(true)
 assert.equal(jobs.length,0);assert.equal(requests.length,4)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRecords.length,10)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Allstate default transport replays all twelve current original responses and retains native holds',async()=>{
 const captured=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-held-20261117.json.gz',import.meta.url))))
 assert.equal(captured.requests.length,12)
 const previousFetch=globalThis.fetch
 let index=0
 globalThis.fetch=async url=>{
  const packet=captured.requests[index++]
  assert.ok(packet,'No unrecorded Allstate requests')
  assert.equal(String(url),packet.requestedURL)
  assert.equal(packet.status,200)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.url})
  return response
 }
 try{
  const jobs=await run()
  assert.equal(index,12)
  assert.equal(jobs.length,8)
  assert.equal(jobs.nativeCollectionEvidence.heldNativeRecords.length,2)
  assert.equal(jobs.nativeCollectionEvidence.closingRawRowsMatch,true)
  const assessment=assessSoftFailureAcquisition({source:'allstate',companyName:'Allstate'},jobs)
  assert.equal(assessment.runnerOutcome.rawRecords,10)
  assert.equal(assessment.runnerOutcome.partial,true)
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }finally{globalThis.fetch=previousFetch}
})

test('Allstate blank application rows still require full native qualification and exact closing models',async t=>{
 for(const mode of ['missing-description','foreign-employer','foreign-country','closing-unmapped-field'])await t.test(mode,async()=>{
  let apiReads=0
  const read=async url=>{
   if(url.startsWith('https://jobsapi-internal.')){
    const payload=structuredClone(originalPayload),row=payload.queryResult.find(record=>record.seo_url==='')
    apiReads++
    if(mode==='missing-description')row.description=''
    if(mode==='foreign-employer')row.company_name='Another employer'
    if(mode==='foreign-country')row.primary_country='US'
    if(mode==='closing-unmapped-field'&&apiReads===2)row.update_date='changed-native-field'
    return 'jobverifyAllstateCallback('+JSON.stringify(payload)+')'
   }
   const packet=url===JOBS_SEARCH_URL?current.requests[0]:previous.originals.find(packet=>packet.url===url)
   assert.ok(packet,'Only captured Allstate responses: '+url)
   return text(packet)
  }
  await assert.rejects(run({fetchText:read,fetchJsonpText:read}),/Allstate/)
 })
})
