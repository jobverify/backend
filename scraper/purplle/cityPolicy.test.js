import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {generateFingerprint} from '../../scraper-support/utils/saveToDB.js'
const now=()=> '2026-10-23T19:30:00.000Z'
const options=mutate=>({fetchImpl:fixtureFetch(mutate),now})
test('reviewed native Mumbai metro label follows existing city policy without inventing country',async()=>{
 const jobs=await run(options()),unknown=jobs.filter(r=>r.country===null)
 assert.equal(jobs.length,9)
 assert.equal(jobs.filter(r=>r.country==='India').length,6)
 assert.deepEqual(unknown.map(r=>r.jobId),['4479287979','4479503345','4405646318'])
 assert.deepEqual(unknown.map(r=>r.postingDate),['2026-10-14','2026-10-14','2026-10-13'])
 assert.ok(unknown.every(r=>r.city==='Mumbai'&&r.location==='Mumbai Metropolitan Region'&&r.region===null&&r.activeApplyVerified))
 assert.ok(unknown.every(r=>normalizeScrapedJob(r,{countryFilter:'India'}).country===null))
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,9)
 assert.equal(new Set(jobs.map(r=>generateFingerprint(normalizeScrapedJob(r,{countryFilter:'India'})))).size,9)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.ok(jobs.every(r=>r.lifecycleCleanupAllowed===false))
})
test('country-null metro roles require the same active same-role application controls',async()=>{
 await assert.rejects(run(options(row=>{
  if(row.url.includes('/jobs/view/')&&row.url.includes('4479287979'))row.body=row.body.replaceAll('data-modal="job-details-topcard-apply-modal"','disabled data-modal="job-details-topcard-apply-modal"').replaceAll('data-modal="job-details-subnav-apply-modal"','disabled data-modal="job-details-subnav-apply-modal"')
  return row
 })),e=>e.code==='PURPLLE_COVERAGE_GAP'&&/Apply/.test(e.message))
})
test('foreign/composite labels cannot use the reviewed metro alias',async()=>{
 for(const label of ['Mumbai Metropolitan Region, Canada','Mumbai Metropolitan Region-London','Mumbai Metropolitan Region (London)','Unknown Metropolitan Region']){
  const jobs=await run(options(row=>{row.body=row.body.replaceAll('Mumbai Metropolitan Region',label);return row}))
  assert.equal(jobs.length,6,label)
  assert.ok(jobs.every(r=>r.country==='India'))
 }
})
test('missing native descriptions do not reject the three city-policy roles',async()=>{
 const jobs=await run(options(row=>{if(row.url.includes('/jobs/view/'))row.body=row.body.replaceAll('class="show-more-less-html__markup','hidden class="show-more-less-html__markup');return row}))
 assert.equal(jobs.length,9)
 assert.ok(jobs.every(r=>r.sourceDescription===null&&!r.sourceDetailComplete))
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(now())}).eligibleJobs.length,9)
})
test('existing age gate still excludes a metro role with an old native listing date',async()=>{
 const jobs=await run(options(row=>{
  if(row.url.includes('/jobs/search/')){
   const doc=document(row.body),card=doc.nodes(n=>n.attrs['data-entity-urn']==='urn:li:jobPosting:4479287979')[0]
   const time=doc.nodes(n=>n.tag==='time',card)[0]
   row.body=row.body.replace(doc.outer(card),doc.outer(card).replace(doc.outer(time),'<time datetime="2025-01-01">old</time>'))
  }
  return row
 }))
 assert.equal(jobs.length,9)
 assert.equal(jobs.find(r=>r.jobId==='4479287979').postingDate,'2025-01-01')
 const metrics=analyzePublishableJobs(jobs,{now:new Date(now())})
 assert.equal(metrics.filterCounts.old,1)
 assert.equal(metrics.eligibleJobs.length,8)
})
test('new country metadata cannot masquerade as an unknown-country metro role',async()=>{
 for(const carrier of ['<meta name="country" content="US">','<span hidden data-country="US"></span>','<meta property="job:country" content="Canada">','<span hidden data-expiry-date="2020-01-01"></span>']){
  await assert.rejects(run(options(row=>{if(row.url.includes('/jobs/view/')&&row.url.includes('4479287979'))row.body=row.body.replace('</h1>','</h1>'+carrier);return row})),e=>e.code==='PURPLLE_COVERAGE_GAP'&&/country|expiry|metadata/i.test(e.message))
 }
})
