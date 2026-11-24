import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const bytes=fs.readFileSync(new URL('./test-data/current-registered-20261121.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(bytes))
const manifest=JSON.parse(fs.readFileSync(new URL('./test-data/current-registered-20261121-manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const replay=(mutate=()=>{})=>{
 const rows=structuredClone(fixture.rows);mutate(rows);const calls=[],seen=new Map()
 const options={now:()=>fixture.assessedAt,fetchImpl:async(url,init)=>{
  const matches=rows.filter(r=>r.requestedURL===url),at=seen.get(url)??0,row=matches[at]
  assert.ok(row,'Undeclared registered replay read '+url);seen.set(url,at+1)
  assert.equal(init.method,row.method);assert.equal(init.body,row.requestBody??undefined);assert.equal(init.credentials,'omit')
  calls.push({url,method:init.method,body:init.body??null})
  const response=new Response(row.body,{status:row.status,headers:{'Content-Type':row.contentType}});Object.defineProperty(response,'url',{value:row.finalURL});return response
 }}
 return {options,calls}
}
const editDetail=(rows,id,edit)=>{const row=rows.find(r=>r.requestedURL.includes('/cp/job/'+id.replaceAll('/','_')+'/')),body=JSON.parse(row.body);edit(body.response);row.body=JSON.stringify(body)}

test('registered fixture retains nineteen complete originals with measured physical count and explicit partial detail health',()=>{
 assert.equal(sha(bytes),manifest.sha256);assert.equal(fixture.rows.length,19);assert.equal(fixture.totalPhysicalRequests,19)
 for(const row of fixture.rows){assert.equal(sha(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes);assert.ok(Date.parse(row.at));assert.equal(row.bodyOriginalUnmodified,true);assert.deepEqual(row.bodyRedactions,[])}
 assert.equal(fixture.expected.nativeCandidateCount,3);assert.equal(fixture.expected.heldCount,1);assert.equal(fixture.expected.detailHealthComplete,false)
})

test('actual registered originals replay two full native roles and preserve every original field, criterion and authored date',async()=>{
 const {options,calls}=replay(),jobs=await run(options),analysis=analyzePublishableJobs(jobs,{now:fixture.assessedAt})
 assert.equal(jobs.length,2);assert.equal(analysis.indiaJobs.length,2);assert.equal(analysis.eligibleJobs.length,2)
 assert.equal(analysis.eligibleJobs.filter(j=>j.sourceDetailComplete===true).length,2)
 assert.deepEqual(calls,fixture.rows.map(r=>({url:r.requestedURL,method:r.method,body:r.requestBody??null})))
 for(const job of jobs){
  const original=JSON.parse(fixture.rows.find(r=>r.requestedURL.includes('/cp/job/'+job.jobId.replaceAll('/','_')+'/')).body).response
  assert.deepEqual(job.nativeSourceRecord,original);assert.equal(job.sourceNativeDescription,original.jobDescription)
  assert.equal(job.postingDate,original.CandidatePortalStartDate.slice(0,10));assert.equal(job.closingDate,original.CandidatePortalEndDate.slice(0,10))
  assert.equal(job.sourceNativeLegalEmployer,'Raymond Realty Limited');assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.deepEqual(jobs.map(j=>[j.jobId,j.postingDate,j.closingDate]),[['RAY/A-M/1924373','2026-11-18','2026-12-02'],['RAY/SA-C/1906697','2026-11-13','2026-11-27']])
 const evidence=jobs[0].nativeCollectionEvidence;assert.equal(evidence.candidateDetails,3);assert.equal(evidence.extractedDetailJobs,2);assert.equal(evidence.failures.length,1)
 assert.equal(evidence.failures[0].id,fixture.expected.heldID);assert.equal(evidence.failures[0].reason,fixture.expected.heldReason)
 assert.equal(evidence.listingPaginationComplete,true);assert.equal(evidence.closingInventoryMatches,true);assert.equal(evidence.sourceScopeComplete,false)
 const health=extractionDetailHealth(jobs);assert.equal(health.complete,false);assert.equal(health.missingDescriptions,0);assert.equal(health.nativeCollections[0].unextractedDetailFailures,1)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

test('held actual model retains authored location levels and unreviewed legal employer without becoming a qualified job',async()=>{
 const held=JSON.parse(fixture.rows.find(r=>r.requestedURL.includes('/cp/job/RAY_A-S_1906579/')).body).response
 assert.equal(held.locationHierarchyComplete,'India>Maharashtra>Mumbai>Bandra');assert.equal(held.joiningLocation,'Mumbai')
 const originalListing=JSON.parse(fixture.rows.find(r=>r.requestedURL.includes('/jobs/v1?')).body).response.find(r=>r.jobCode===fixture.expected.heldID)
 assert.equal(originalListing.locationHierarchy,'Mumbai');assert.equal(originalListing.locationHierarchyComplete,held.locationHierarchyComplete)
 assert.equal(held.organizationUnitComplete.split('>')[3],'Ten X Realty Limited');assert.equal(held.CandidatePortalStartDate,'2026-11-16 00:00:00.0')
 // Explicitly controlled mutants isolate the second guard; original bytes and
 // both actually authored Mumbai labels above remain unchanged in the fixture.
 const {options}=replay(rows=>{
  editDetail(rows,fixture.expected.heldID,p=>{p.joiningLocation='Bandra'})
  for(const row of rows.filter(r=>r.requestedURL.includes('/jobs/v1?'))){const body=JSON.parse(row.body);body.response.find(r=>r.jobCode===fixture.expected.heldID).locationHierarchy='Bandra';row.body=JSON.stringify(body)}
 }),jobs=await run(options)
 assert.equal(jobs.length,2);assert.ok(!jobs.some(j=>j.jobId===fixture.expected.heldID))
 assert.match(jobs[0].nativeCollectionEvidence.failures[0].reason,/Unreviewed native legal employer hierarchy/)
})

test('current genuine models keep unknown/foreign countries, full criteria and publication inconsistencies held',async()=>{
 for(const [field,value]of [['locationHierarchyComplete','Canada>Ontario>Toronto>Toronto'],['jobDescription','<template>hidden only</template>'],['CandidatePortalStartDate','2099-01-01 00:00:00.0']]){
  const {options}=replay(rows=>editDetail(rows,'RAY/A-M/1924373',p=>{p[field]=value})),jobs=await run(options)
  assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'RAY/SA-C/1906697');assert.equal(jobs[0].nativeCollectionEvidence.failures.length,2)
 }
})

test('current genuine closing listing changes invalidate the run while retaining native observations',async()=>{
 const {options}=replay(rows=>{const row=rows.filter(r=>r.requestedURL.includes('/jobs/v1?')).at(-1),body=JSON.parse(row.body);body.response[0].jobTitle='Unreconciled closing title';row.body=JSON.stringify(body)})
 await assert.rejects(run(options),error=>error.message.includes('Opening/closing native inventory changed')&&error.nativeCollectionEvidence.candidateDetails===3&&error.nativeCollectionEvidence.closingInventoryMatches===false)
})

test('serializable saved jobs retain full native detail flags separately from incomplete listing and company health',async()=>{
 const jobs=JSON.parse(JSON.stringify(await run(replay().options))),analysis=analyzePublishableJobs(jobs,{now:fixture.assessedAt}),health=extractionDetailHealth(analysis.eligibleJobs)
 assert.equal(analysis.eligibleJobs.length,2);assert.equal(analysis.eligibleJobs.filter(j=>j.sourceDetailComplete===true).length,2)
 assert.equal(health.complete,false);assert.equal(health.missingDescriptions,0);assert.equal(health.nativeCollections[0].observedListingRows,3)
 assert.equal(health.nativeCollections[0].parsedDetails,2);assert.equal(health.nativeCollections[0].unextractedDetailFailures,1);assert.equal(health.nativeCollections[0].sourceScopeComplete,false)
})
