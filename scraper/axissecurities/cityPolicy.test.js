import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {fixtureFetch} from './fixtureReplay.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {normalizeScrapedJob} from '../../scraper-support/utils/normalizeScrapedJob.js'
const now=new Date('2026-10-23T18:20:00Z')
test('Axis follows the existing city policy without asserting a native country',async()=>{
 const jobs=await run({fetchImpl:fixtureFetch()})
 assert.equal(jobs.length,66)
 assert.ok(jobs.every(job=>job.country===null))
 assert.ok(jobs.some(job=>job.location.trim()==='Central Delhi'))
 assert.equal(jobs.some(job=>job.location.trim()==='Ghansoli'),false)
 const metrics=analyzePublishableJobs(jobs,{now})
 assert.equal(metrics.eligibleJobs.length,0)
 assert.equal(metrics.filterCounts.old,66)
 assert.equal(normalizeScrapedJob(jobs[0],{countryFilter:'India'}).country,null)
})
const changeFirst=(record,kind,url,change)=>{
 if(kind==='listing'||kind==='detail'){
  const p=JSON.parse(record.body)
  if(kind==='listing'){for(const row of p.jobVoList)if(row.jobSeq==='645595')change(row)}
  else if(new URL(url).searchParams.get('jobSeq')==='645595')change(p.jobVO)
  record.body=JSON.stringify(p)
 }
 return record
}
test('an otherwise eligible city-only role with missing JD remains partial and eligible',async()=>{
 const jobs=await run({fetchImpl:fixtureFetch((r,k,u)=>changeFirst(r,k,u,row=>{
  row.jobPostingDate='22-Oct-2026';row.publishDetails={...row.publishDetails,CAREER_SITE:'2026-10-22T00:00:00Z'};row.jobDesc=null
 }))})
 const job=jobs.find(j=>j.jobId==='645595');assert.ok(job)
 assert.equal(job.country,null);assert.equal(job.jobDescription,null);assert.equal(job.sourceDetailComplete,false)
 assert.equal(analyzePublishableJobs(jobs,{now}).eligibleJobs.length,1)
})
for(const location of ['London','Mumbai, Canada','Mumbai, USA','Mumbai, Florida','Mumbai - London','Mumbai (London)','Mumbai & London'])test('does not admit foreign or unresolved composite location '+location,async()=>{
 const jobs=await run({fetchImpl:fixtureFetch((r,k,u)=>changeFirst(r,k,u,row=>{row.locations=row.jobLocation=location}))})
 assert.equal(jobs.some(j=>j.jobId==='645595'),false)
})
test('new native expiry data requires reconciliation before publication',async()=>{
 await assert.rejects(run({fetchImpl:fixtureFetch((r,k,u)=>changeFirst(r,k,u,row=>row.validThrough='2026-10-01'))}),/expiry|temporal/i)
})
