import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {BOUNTEOUS_JOB_ROUTE_PREFIX,CAREER_PAGE_URL,TURBOHIRE_ENDPOINT,createAccoliteDigitalScraper,extractSearchResults} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const pages=new Map(['bounteous','accolitedigital'].flatMap(source=>JSON.parse(gunzipSync(readFileSync(new URL('../'+source+'/test-data/native-20261103.json.gz',import.meta.url))))).map(row=>[row.requestedUrl,row]))
test('uses the current declared Bounteous routes for the historical Accolite source',()=>{
 assert.equal(CAREER_PAGE_URL,'https://www.bounteous.com/careers/search-results')
 assert.equal(TURBOHIRE_ENDPOINT,'https://www.bounteous.com/turbohire/api/')
 assert.equal(BOUNTEOUS_JOB_ROUTE_PREFIX,'https://www.bounteous.com/careers/job/')
})
test('current public records retain native Bounteous company and opaque posting identities',()=>{
 const jobs=extractSearchResults(JSON.parse(pages.get(TURBOHIRE_ENDPOINT).body))
 assert.equal(jobs.length,69);assert.equal(jobs[0].requisitionId,null)
 assert.ok(jobs.every(job=>job.company==='Bounteous'&&job.sourceUrl.endsWith(job.jobId)))
})
test('historical result cap retains a truthful partial canonical inventory',async()=>{
 const jobs=await createAccoliteDigitalScraper({maxJobs:1}).run({fetchPage:async url=>structuredClone(pages.get(url))})
 assert.equal(jobs.length,1);assert.equal(jobs[0].source,'bounteous');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
