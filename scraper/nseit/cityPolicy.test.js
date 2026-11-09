import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
const captures=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/official-responses.json.gz',import.meta.url))))
const options=(mutate=(body)=>body)=>({now:()=> '2026-10-23T18:50:00.000Z',fetchImpl:async url=>{
 const row=captures.find(r=>r.url===url)
 assert.ok(row,'Uncaptured NSEIT request '+url)
 const response=new Response(mutate(row.body,url),{status:row.status})
 Object.defineProperty(response,'url',{value:row.finalUrl});return response
}})
test('matching native Mumbai labels pass existing city policy without manufacturing a country or new publication date',async()=>{
 const jobs=await run(options())
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].city,'Mumbai')
 assert.equal(jobs[0].jobId,'35855')
 assert.equal(jobs[0].postingDate,'2025-09-02T20:32:29+05:30')
 assert.equal(normalizeScrapedJob(jobs[0],{countryFilter:'India'}).country,null)
 const metrics=analyzePublishableJobs(jobs,{now:new Date('2026-10-23T18:50:00.000Z')})
 assert.equal(metrics.eligibleJobs.length,0)
 assert.equal(metrics.filterCounts.old,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('missing active description retains an otherwise valid country-null city discovery',async()=>{
 const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?body.replace('<div class="awsm-job-entry-content entry-content">','<div hidden class="awsm-job-entry-content entry-content">'):body))
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDescription,null)
 assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('structured city-only native address also qualifies without a country',async()=>{
 const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai"}'):body))
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].city,'Mumbai')
})
test('schema/listing city disagreement and composite cities cannot use the city fallback',async()=>{
 for(const address of ['Bangalore','Mumbai-London','Mumbai (London)','Mumbai, India','London']){
  const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?body.replace('"address":"Mumbai"','"address":'+JSON.stringify(address)):body))
  assert.equal(jobs.length,0,address)
 }
})
test('explicit foreign and unrecognized country carriers cannot use the city fallback',async()=>{
 for(const country of ['CA','US','Atlantis']){
  const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressCountry":'+JSON.stringify(country)+'}'):body))
  assert.equal(jobs.length,0,country)
 }
})
test('unknown-country native foreign region cannot use a Mumbai locality',async()=>{
 const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?body.replace('"address":"Mumbai"','"address":{"addressLocality":"Mumbai","addressRegion":"Ontario"}'):body))
 assert.equal(jobs.length,0)
})
test('expired and future-dated city-only roles remain withheld',async()=>{
 for(const mutate of [body=>body.replace('"datePosted":','"validThrough":"2026-10-01","datePosted":'),body=>body.replace('2025-09-02T20:32:29+05:30','2027-09-02T20:32:29+05:30')]){
  const jobs=await run(options((body,url)=>url.includes('/currentopenings/')?mutate(body):body))
  assert.equal(jobs.length,0)
 }
})
test('visible location conflicts remain blocking even when native description is incomplete',async()=>{
 for(const content of ['<p>Location: London</p>','<h2>Helpdesk Executive</h2><p>Location: Toronto, Canada</p>']){
  await assert.rejects(run(options((body,url)=>url.includes('/currentopenings/')?body.replace(/<div class="awsm-job-entry-content entry-content">[\s\S]*?<\/div><!-- \.awsm-job-entry-content -->/,'<div class="awsm-job-entry-content entry-content">'+content+'</div>'):body)),/visible location conflict/)
 }
})
