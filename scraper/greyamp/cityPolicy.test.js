import test from 'node:test'
import assert from 'node:assert/strict'
import {run,inspectInventory} from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
import {generateFingerprint} from '../../scraper-support/utils/saveToDB.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const options={now:()=> '2026-10-23T18:30:00Z'}
const mutateRows=change=>record=>{
 if(record.url.endsWith('/api/job-openings')){const rows=JSON.parse(record.body);change(rows);record.body=JSON.stringify(rows)}
 return record
}
test('Greyamp retains three city-scope jobs with unknown countries and native travel notes',async()=>{
 const jobs=await run({...options,fetchImpl:fixtureFetch()})
 assert.equal(jobs.length,3)
 assert.ok(jobs.every(j=>j.country===null&&j.city==='Bangalore'&&j.postingDate===null))
 assert.ok(jobs.every(j=>j.location==='Bangalore, travel to client locations based on requirement'))
 assert.ok(jobs.every(j=>j.nativePrimaryLocation===j.location&&j.sourceGeographyComplete===false))
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(options.now())}).eligibleJobs.length,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('shared employer application forms keep distinct native role identities through normalization',async()=>{
 const inventory=await inspectInventory({...options,fetchImpl:fixtureFetch()})
 assert.equal(new Set(inventory.jobs.map(j=>j.applyUrl)).size,1)
 const normalized=inventory.jobs.map(j=>normalizeScrapedJob(j,{countryFilter:'India'}))
 assert.equal(new Set(normalized.map(generateFingerprint)).size,3)
 assert.ok(normalized.every(j=>j.country===null))
 for(const job of normalized)assert.equal(generateFingerprint(job),generateFingerprint({...job,title:'Updated native role title'}))
})
for(const location of ['London','Bangalore, Canada','Bangalore - London, travel to client locations based on requirement','Bangalore, travel to London','Bangalore, India / Singapore'])test('foreign or unreviewed location is not accepted: '+location,async()=>{
 let jobs
 try{jobs=await run({...options,fetchImpl:fixtureFetch(mutateRows(rows=>rows[0].location=location))})}
 catch(error){assert.match(error.message,/geographic|country|location/i);return}
 assert.equal(jobs.some(j=>j.jobId==='6a229735-a6a3-4f52-b002-f3a491a5097e'),false)
})
test('otherwise eligible city-scope jobs with missing descriptions remain partial',async()=>{
 const jobs=await run({...options,fetchImpl:fixtureFetch(mutateRows(rows=>{
  rows[0].description=rows[0].title;rows[0].roleOverview=['<div inert>Invisible employer prose for an advertised role.</div>'];rows[0].keyResponsibilities=['<h2>Responsibilities</h2>']
 }))})
 assert.equal(jobs.length,3);assert.equal(jobs[0].jobDescription,null);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(analyzePublishableJobs(jobs,{now:new Date(options.now())}).eligibleJobs.length,3)
})
test('new native expiry metadata cannot be ignored by city eligibility',async()=>{
 await assert.rejects(run({...options,fetchImpl:fixtureFetch(mutateRows(rows=>rows[0].validThrough='2026-10-01'))}),/unreviewed native schema/)
})
