import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as codewave from '../../scraper/codewavetechnologies/script.js'
import * as deltecs from '../../scraper/deltecs/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/capture.json.gz',import.meta.url))))
const expectations=JSON.parse(fs.readFileSync(new URL('./fixtures/codewaveDeltecs20261106/description-expectations.json',import.meta.url),'utf8'))
const page=url=>{assert.ok(fixture.documents[url],'Only genuine captured source URLs may be read: '+url);return fixture.documents[url]}
const options=()=>({now:()=> '2026-11-06T10:30:00.000Z',
 fetchPage:async url=>{const row=page(url);return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body,bodyUnavailable:row.bodyUnavailable}},
 fetchText:async url=>{const row=page(url);if(row.status!==200)throw Object.assign(Error('HTTP '+row.status+' for '+url),{status:row.status});return row.body}})
const compact=value=>value.replace(/\s/g,'')

test('Codewave accepts its current canonical first-party native careers document',()=>{
 assert.equal(codewave.hasOfficialCareersSignal(page('https://codewave.com/careers').body),true)
})
test('Codewave current configured collector preserves12 explicitly India rows and full native criteria',async()=>{
 const jobs=await codewave.run(options())
 assert.equal(jobs.length,12)
 assert.equal(new Set(jobs.map(row=>row.jobId)).size,12)
 for(const job of jobs){
  assert.equal(job.country,'India')
  assert.equal(job.requisitionId,null)
  assert.equal(compact(job.jobDescription),expectations.codewave[job.jobId].completeDescriptionWithoutWhitespace)
  assert.equal(job.postingDate,null)
  assert.equal(job.closingDate,null)
  assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('DronaHQ accepts its current first-party home with the retained Deltecs employer binding',()=>{
 assert.equal(deltecs.hasOfficialHomepageSignal(page('https://www.dronahq.com/').body),true)
})
test('DronaHQ current configured collector preserves its native India post and all original role criteria',async()=>{
 const jobs=await deltecs.run(options())
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].title,'Legal Executive')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].jobId,'35166')
 assert.equal(jobs[0].requisitionId,null)
 assert.equal(compact(jobs[0].jobDescription),expectations.deltecs.completeDescriptionWithoutWhitespace)
 assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].closingDate,null)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
