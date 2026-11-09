import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createKbrScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=name=>fs.readFileSync(new URL('../../scraper-support/tests/fixtures/kbr/'+name,import.meta.url),'utf8')
const original=JSON.parse(fixture('current-snapshot.json'))
const exercise=location=>{
 const snapshot=structuredClone(original);snapshot.jobs.find(j=>!j.application_url).location=location
 return createKbrScraper({now:()=> '2026-10-08T18:00:00.000Z'}).run({fetchText:async url=>{
  if(url==='https://www.kbr.com/en')return fixture('homepage.html')
  if(url==='https://careers.kbr.com/us/en')return fixture('migration-overview.html')
  if(url==='https://jobs.kbr.com/jobs.html')return fixture('current-jobs.html')
  if(url==='https://jobs.kbr.com/data/kbr-jobs.json')return JSON.stringify(snapshot)
  if(url==='https://apply.workable.com/api/v1/widget/accounts/kbr')return JSON.stringify({name:'KBR',jobs:[]})
  if(url.endsWith('/Designer_R2109999'))return fixture('current-workday-detail.json')
  throw Error('Unexpected public URL '+url)
 },fetchJson:async(url,options)=>JSON.parse(options.body).searchText==='R2109999'?{total:1,jobPostings:[{bulletFields:['R2109999']}]}:{total:0,jobPostings:[]}})
}
test('KBR recognizes an explicitly published full country name on an unlinked snapshot requisition',async()=>{
 const jobs=await exercise('Chennai, Tamil Nadu, India');assert.deepEqual(jobs.map(j=>j.jobId),['R2109999']);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('KBR retains verified full India criteria while an unlinked city-only native location remains explicit and incomplete',async()=>{
 const jobs=await exercise('Houston, Texas');assert.deepEqual(jobs.map(j=>j.jobId),['R2109999'])
 assert.equal(jobs[0].country,'India');assert.match(jobs[0].sourceDescription||jobs[0].jobDescription,/detail design deliverables/i)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(jobs[0].nativeCollectionEvidence.unresolvedCountryRows[0].location,'Houston, Texas')
})
