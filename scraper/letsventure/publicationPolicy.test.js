import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,API_URL} from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {decodeJavaScriptStringLiteral} from '../../scraper-support/utils/safeLiteral.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {generateFingerprint} from '../../scraper-support/utils/saveToDB.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const now=()=> '2026-10-23T19:10:00.000Z'
const options=mutate=>({fetchImpl:fixtureFetch(mutate),now})
const changeDetails=change=>row=>{
 if(/\/jobs\/Careers\/\d+\//.test(row.url))row.body=row.body.replace(/\bvar jobs\s*=\s*JSON\.parse\(('(?:\\.|[^'\\])*')\)\s*;/,(_,literal)=>{
  const jobs=JSON.parse(decodeJavaScriptStringLiteral(literal));jobs.forEach(change)
  const encoded=JSON.stringify(jobs).replace(/\\/g,'\\\\').replace(/'/g,"\\'")
  return "var jobs = JSON.parse('"+encoded+"');"
 })
 return row
}
test('native Remote records follow existing eligibility with their original publicly displayed 2022 dates',async()=>{
 const jobs=await run(options())
 assert.equal(jobs.length,3)
 assert.deepEqual(jobs.map(r=>r.postingDate),['2022-07-18','2022-04-20','2022-04-11'])
 assert.ok(jobs.every(r=>r.country===null&&r.city==='Remote'&&r.location==='Remote'&&r.nativeDateOpenedIsPublicationDate===true))
 assert.ok(jobs.every(r=>r.source==='letsventure'&&r.company==='LetsVenture'&&r.sourceDetailComplete===true))
 assert.ok(jobs.every(r=>normalizeScrapedJob(r,{countryFilter:'India'}).country===null))
 const metrics=analyzePublishableJobs(jobs,{now:new Date(now())})
 assert.equal(metrics.eligibleJobs.length,0)
 assert.equal(metrics.filterCounts.old,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs.every(r=>r.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.excludedNativeCandidates.length,1)
})
test('captured public rendered Posted-on dates bind to each canonical native role URL',async()=>{
 const observations=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/public-posting-date-observations.json.gz',import.meta.url))))
 const jobs=await run(options())
 assert.equal(observations.length,3)
 for(const job of jobs){
  const observed=observations.find(r=>r.url===job.sourceUrl)
  assert.ok(observed)
  assert.ok(observed.title.includes(job.title))
  const dates=[...observed.text.matchAll(/Posted on (\d\d)\/(\d\d)\/(\d{4})/g)]
  assert.equal(dates.length,1)
  assert.equal(job.postingDate,`${dates[0][3]}-${dates[0][1]}-${dates[0][2]}`)
 }
})
test('native role URLs preserve distinct identities and missing native descriptions stay partial',async()=>{
 const jobs=await run(options(changeDetails(job=>{job.Job_Description=null})))
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(r=>r.sourceDescription===null&&r.jobDescription===null&&!r.sourceDetailComplete))
 assert.equal(new Set(jobs.map(r=>generateFingerprint(normalizeScrapedJob(r,{countryFilter:'India'})))).size,3)
})
test('title-only native descriptions remain partial without dropping dated role facts',async()=>{
 const jobs=await run(options(changeDetails(job=>{job.Job_Description=job.Posting_Title})))
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(r=>r.sourceDescription===null&&!r.sourceDetailComplete))
})
test('missing or invalid native public posting dates cannot refresh original dated roles',async()=>{
 for(const value of [null,'','2026-02-30','2026-10-23T01:00:00Z','tomorrow']){
  await assert.rejects(run(options(changeDetails(job=>{job.Date_Opened=value}))),e=>e.code==='LETSVENTURE_COVERAGE_GAP'&&/publication|posting|date/i.test(e.message))
 }
})
test('a newly supplied API publication carrier must agree with canonical public detail date',async()=>{
 await assert.rejects(run(options(row=>{
  if(row.url===API_URL){const value=JSON.parse(row.body);value.data[0].Date_Opened='2026-10-23';row.body=JSON.stringify(value)}
  return row
 })),e=>e.code==='LETSVENTURE_COVERAGE_GAP'&&/date|publication/i.test(e.message))
})
test('native future publication dates cannot become current eligible roles',async()=>{
 const jobs=await run(options(changeDetails(job=>{job.Date_Opened='2027-01-01'})))
 assert.equal(jobs.length,0)
})
test('an unavailable independent search preserves native dated jobs and reports incomplete auxiliary coverage',async()=>{
 const jobs=await run(options(row=>row.url.includes('/jobs/search/')?{...row,status:429,body:'Rate limited'}:row))
 assert.equal(jobs.length,3)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).filterCounts.old,3)
 assert.equal(jobs.nativeCollectionEvidence.scopedSearchObservedCards,null)
 assert.equal(jobs.nativeCollectionEvidence.independentDiscoveryGaps.length,1)
 assert.match(readInventoryEvidence(jobs).reason,/independent discovery unavailable/i)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
