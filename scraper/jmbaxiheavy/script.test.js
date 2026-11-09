import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {hasJobSearchPageSignal,createJmBaxiHeavyScraper,HOMEPAGE_URL,CAREERS_URL,JOB_SEARCH_URL,RESUME_SUBMIT_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {resolveZeroJobOutcome} from '../../scraper-support/runner.js'
const search = fs.readFileSync(new URL('./fixtures/search-current.html',import.meta.url),'utf8')
test('JM Baxi validates current search form without requiring removed dropdown options',()=>{
 assert.equal(hasJobSearchPageSignal(search),true)
 assert.equal(hasJobSearchPageSignal(search.replace('action="job-list.html"','action="https://example.com/"')),false)
 assert.equal(hasJobSearchPageSignal(search.replace('name="home_department"','name="unrelated"')),false)
})

test('JM Baxi explicit Engineering zero is accepted by the runner and malformed responses fail closed',async()=>{
 const fetchText=async url=>url===HOMEPAGE_URL?'<title>Home | J M Baxi</title>Welcome to J M Baxi Group. Creating Opportunities':url===CAREERS_URL?'<title>Careers | J M Baxi</title>Harboring Talent, Fostering Careers. Explore, Engage, Excel. Job Search':url===JOB_SEARCH_URL?search:'<title>Job List | J M Baxi</title>Explore your future with J M Baxi Group. Thanks for checking out our job openings. '+"var home_department = 'engineering'; action: 'joblist'; "+RESUME_SUBMIT_URL
 const payload={jobshtml:'<div class="no-data-found">No data found!!!</div>',totalPages:0,totalRecords:null}
 const jobs=await createJmBaxiHeavyScraper().run({fetchText,fetchJson:async()=>payload})
 assert.equal(readInventoryEvidence(jobs)?.reportedTotal,0)
 assert.equal(resolveZeroJobOutcome({provider:{zeroResultPolicy:'evidence-required'}},jobs,[]),'verified-empty')
 await assert.rejects(createJmBaxiHeavyScraper().run({fetchText,fetchJson:async()=>({...payload,totalPages:1})}),/postings|public/i)
})
