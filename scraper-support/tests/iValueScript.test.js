import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import * as source from '../../scraper/ivalue/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const f=JSON.parse(fs.readFileSync(new URL('../../scraper/ivalue/fixtures/native-20261020.json',import.meta.url)))
const now=()=> '2026-10-20T23:20:00.000Z'
test('iValue preserves source and exact official/native employer identities without old runtime counts',()=>{
 assert.equal(source.SOURCE,'ivalue');assert.equal(source.COMPANY,'iValue');assert.equal(source.VERIFIED_ON,null)
 assert.equal(source.OFFICIAL_CAREERS_URL,'https://ivaluegroup.com/en-in/careers/working-at-ivalue/')
 assert.equal(source.JOBS_PAGE_URL,'https://ivgroup.greythr.com/hire/jobs/')
 assert.equal(source.hasOfficialCareersBlockSignal(f.corporateBlocked),true)
 assert.equal(source.hasPublicJobsPageSignal(f.board),true)
 assert.equal(source.hasCompanyDetailsSignal(f.company),true)
 assert.equal(source.buildLocationLookup(f.categories)['2'],'Delhi')
})
test('iValue verifies every native detail and final feed/category snapshot while company scope stays incomplete',async()=>{
 const calls=[],rows=[f.listing.data[0],f.listing.data.find(r=>r.locations.includes('972'))]
 const jobs=await source.run({now,fetchText:async url=>url===source.JOBS_PAGE_URL?f.board:f.corporateBlocked,fetchJson:async(url,o)=>{
  calls.push({url,method:o.method,body:o.body,signal:o.signal})
  if(url===source.COMPANY_DETAILS_URL)return f.company
  if(url===source.EMPLOYMENT_CATEGORIES_URL)return f.categories
  if(url===source.JOBS_API_URL)return {data:rows}
  const row=rows.find(r=>url==='https://ivgroup.greythr.com/hire/api/career/get_job/'+r.slug+'/')
  if(row)return {job_status:'published',job:row}
  throw new Error('Unexpected native URL')
 }})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,rows[0].id);assert.equal(jobs[0].location,'Delhi')
 assert.equal(jobs[0].country,'India');assert.equal(jobs[0].applyUrl,rows[0].apply_url);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(calls.filter(r=>r.url===source.JOBS_API_URL).length,2)
 assert.equal(calls.filter(r=>r.url===source.EMPLOYMENT_CATEGORIES_URL).length,2)
 assert.equal(calls.filter(r=>r.url.includes('/get_job/')).length,2)
 assert.ok(calls.every(r=>r.signal instanceof AbortSignal))
})
test('iValue rejects changed official and native board identity',async()=>{
 await assert.rejects(source.run({now,fetchText:async()=>'<h1>iValue</h1>'}),/official handoff unavailable/)
 await assert.rejects(source.run({now,fetchText:async url=>url===source.JOBS_PAGE_URL?'<h1>Other company</h1>':f.corporateBlocked}),/Native board title mismatch/)
})
