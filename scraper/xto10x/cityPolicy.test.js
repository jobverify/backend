import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const now=()=> '2026-10-23T19:35:00.000Z'
const options=mutate=>({fetchImpl:fixtureFetch(mutate),now})
const changeData=change=>row=>{
 if(row.url.includes('gladiator.iimjobs.com/job/detail')){const payload=JSON.parse(row.body);change(payload.data);row.body=JSON.stringify(payload)}
 return row
}
test('two employer-authored city-labelled records retain unknown country and earliest native dates',async()=>{
 const jobs=await run(options())
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(j=>j.jobId),['1728041','1728042'])
 assert.deepEqual(jobs[0].locations,['Bangalore','Delhi NCR'])
 assert.deepEqual(jobs[1].locations,['Bangalore'])
 assert.ok(jobs.every(j=>j.company==='XTO10X'&&j.country===null&&j.postingDate==='2026-08-28T18:30:00.000Z'))
 assert.ok(jobs.every(j=>j.sourceDescription.length>4000&&j.sourceDetailComplete&&j.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(j=>normalizeScrapedJob(j,{countryFilter:'India'}).country===null))
 const metrics=analyzePublishableJobs(jobs,{now:new Date(now())})
 assert.equal(metrics.eligibleJobs.length,0)
 assert.equal(metrics.filterCounts.old,2)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('all native job locations must qualify; foreign or composite labels cannot be partially dropped',async()=>{
 for(const name of ['London','Bangalore-London','Unknown']){
  const jobs=await run(options(changeData(data=>{data.locations[0].name=name;data.location=data.locations})))
  assert.equal(jobs.length,0,name)
 }
 await assert.rejects(run(options(changeData(data=>{data.locations[0].name='Delhi NCR, Canada';data.location=data.locations}))),e=>e.code==='XTO10X_COVERAGE_GAP')
})
test('missing native descriptions retain dated partial records',async()=>{
 const jobs=await run(options(changeData(data=>{data.introText=null})))
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(j=>j.sourceDescription===null&&j.jobDescription===null&&!j.sourceDetailComplete))
})
test('role headings and description section labels remain partial without dropping native records',async()=>{
 for(const label of ['Responsibilities','Requirements','Job description']){
  const jobs=await run(options(changeData(data=>{data.introText='<h2>'+data.title+'</h2><p>'+label+'</p>'})))
  assert.equal(jobs.length,2)
  assert.ok(jobs.every(j=>j.sourceDescription===null&&j.sourceDetailComplete===false))
 }
})
test('new country or expiry carriers require reconciliation before unknown-country recovery',async()=>{
 for(const fields of [{country:'Canada'},{expiryDate:'2020-01-01'},{Created_At:'2025-01-01'},{UPDATED_AT:'2025-01-01'},{otherLocation:'London'},{jobJdContent:'New structured JD'}]){
  await assert.rejects(run(options(changeData(data=>Object.assign(data,fields)))),e=>e.code==='XTO10X_COVERAGE_GAP')
 }
})
test('native JSON APIs negotiate JSON while corporate and employer pages negotiate HTML',async()=>{
 const replay=fixtureFetch();let apiCalls=0
 const jobs=await run({now,fetchImpl:async(url,init)=>{
  const json=url.includes('gladiator.iimjobs.com/job/detail')
  assert.equal(init.headers.Accept,json?'application/json':'text/html')
  if(json)apiCalls++
  return replay(url,init)
 }})
 assert.equal(jobs.length,2)
 assert.equal(apiCalls,2)
})
test('independent LinkedIn search failures preserve native role facts with explicit coverage gaps',async()=>{
 const jobs=await run(options(row=>row.url.includes('/jobs/search/')?{...row,status:429,body:'Rate limited'}:row))
 assert.equal(jobs.length,2)
 assert.equal(jobs.nativeCollectionEvidence.observations.scopedSearches.length,0)
 assert.equal(jobs.nativeCollectionEvidence.independentDiscoveryGaps.length,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
