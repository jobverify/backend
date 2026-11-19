import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {run} from './script.js'
import {LISTING_URL,normalizeCurrentFinolexRecord} from './currentNative.js'
import {sourceLifecycleCleanupForbidden,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-geography-20261119.json.gz',import.meta.url))))
const native=JSON.parse(fixture.responses.find(row=>row.url===LISTING_URL).body)
const sha=value=>createHash('sha256').update(value).digest('hex')
const replay=({closingRecords}={})=>{
 const counts=new Map()
 return {fetchPage:async(url,init)=>{
  const rows=fixture.responses.filter(row=>row.url===url),count=counts.get(url)||0
  assert.ok(rows[count],'Unexpected native read '+url)
  const row=rows[count]
  counts.set(url,count+1)
  assert.equal(sha(row.body),row.sha256)
  assert.equal(init.method,url===LISTING_URL?'POST':'GET')
  assert.equal(init.body??null,url===LISTING_URL?'Activity=joblist':null)
  return closingRecords&&url===LISTING_URL&&count===1?{...row,body:JSON.stringify(closingRecords)}:row
 }}
}

test('Finolex qualifies fourteen current native city/state records without changing originals or full criteria',async()=>{
 const jobs=await run(replay())
 assert.equal(jobs.length,14)
 assert.deepEqual(jobs.map(row=>row.sourceNativeJobRecord),native)
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceCountryScopeUnresolved===false))
 assert.ok(jobs.every(row=>row.sourceDescriptionHTML===row.sourceNativeJobRecord.summary&&row.sourceDetailComplete))
 assert.ok(jobs.every(row=>row.postingDate===null&&row.requisitionId===null&&row.lifecycleCleanupAllowed===false))
 assert.ok(jobs.filter(row=>row.sourceNativeJobRecord.city==='FIL Vendor Site').every(row=>row.city===null&&row.state==='Maharashtra'))
 assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,0)
 assert.equal(jobs.nativeCollectionEvidence.observedIndiaCount,14)
 assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,true)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const assessment=assessSoftFailureAcquisition(getScraperCatalog().find(row=>row.source==='finolexindustrieslimited'),jobs)
 assert.equal(assessment.runnerOutcome.success,true)
 assert.equal(assessment.indiaJobs,14)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

for(const [city,state] of [
 ['Pune, Canada','Maharashtra'],['Remote','Maharashtra'],['Toronto','Maharashtra'],
 ['Pune','Maharashtra, Canada'],['Pune','Ontario'],['Pune / London','Maharashtra'],
]){
 test('Finolex retains unresolved whole native geography '+city+' / '+state,()=>{
  const row={...native[0],city,state},job=normalizeCurrentFinolexRecord(row)
  assert.equal(job.country,null)
  assert.equal(job.sourceCountryScopeUnresolved,true)
  assert.deepEqual(job.sourceNativeJobRecord,row)
 })
}

for(const statement of ['This position is closed and we are no longer accepting applications.','Work Country: Canada.','Employer: Other Company.']){
 test('Finolex refuses contradictory complete native criteria: '+statement,()=>{
  assert.throws(()=>normalizeCurrentFinolexRecord({...native[0],summary:native[0].summary+'<p>'+statement+'</p>'}),/closed|country|employer/)
 })
}

test('Finolex excludes a native role whose original geography changes at closing and retains both full snapshots',async()=>{
 const closing=structuredClone(native)
 closing[0].state='Ontario'
 const jobs=await run(replay({closingRecords:closing}))
 assert.equal(jobs.length,13)
 assert.ok(!jobs.some(row=>row.jobId===String(native[0].id)))
 assert.deepEqual(jobs.nativeCollectionEvidence.originalOpeningRecords,native)
 assert.deepEqual(jobs.nativeCollectionEvidence.originalClosingRecords,closing)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
