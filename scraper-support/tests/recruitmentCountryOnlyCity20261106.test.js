import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../utils/verifiedRecruitment.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

// Authored synthetic controls through the modified shared projection. These
// pages are not employer captures or evidence of a current source recheck.
const config={source:'synthetic-country-only-city',companyName:'Example Corporation',
 companyDomain:'employer.test',companyCareerPage:'https://employer.test/careers'}
const description='<p>Design and maintain production software services, review API contracts, investigate distributed system failures, and collaborate with the product engineering team.</p>'
const clock='2026-11-05T22:00:00.000Z'
async function run(address){
 const row={'@type':'JobPosting',identifier:{value:'synthetic-country-city'},title:'Software Engineer',
  url:'https://employer.test/careers/jobs/synthetic-country-city',hiringOrganization:{name:config.companyName},
  description,datePosted:'2026-10-30',jobLocation:{address}}
 const detail='<h1>'+row.title+'</h1>'+description+'<script type="application/ld+json">'+JSON.stringify(row)+'</script>'
 const jobs=await createVerifiedRecruitmentScraper(config).run({now:()=>clock,maxRequests:8,maxPages:3,maxDetails:3,
  fetchPage:async url=>({status:200,url,html:url===row.url?detail:
   '<h1>Example Corporation Careers</h1><a href="'+row.url+'">Open job</a>'})})
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].lifecycleCleanupAllowed,false)
 assert.equal(readSourceObservationEvidence(jobs,config.source).observedVacancyCount,1)
 return{jobs,row}
}
test('shared recruitment projection preserves a country-only India address without inventing a city',async()=>{
 const {jobs,row}=await run({addressCountry:'IN'})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].location,'India')
 assert.equal(jobs[0].city,null)
 assert.deepEqual(jobs[0].nativeSourceRecord,row)
})
test('shared recruitment projection retains an explicit native India city',async()=>{
 const {jobs,row}=await run({addressCountry:'IN',addressLocality:'Bengaluru'})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].city,'Bangalore')
 assert.deepEqual(jobs[0].nativeSourceRecord,row)
})
test('shared recruitment projection retains a foreign observation without manufacturing an India job',async()=>{
 const {jobs}=await run({addressCountry:'US',addressLocality:'San Francisco'})
 assert.equal(jobs.length,0)
})
