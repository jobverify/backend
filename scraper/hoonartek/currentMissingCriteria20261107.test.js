import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL,JOBS_API_URL,buildJobDetailApiUrl,extractIndiaListingStubs} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const get=url=>{const row=capture.packets.find(row=>row.requestUrl===url);assert.ok(row,'Only retained native URLs: '+url);return row}
const options=(change=(url,payload)=>payload)=>({
 fetchPage:async url=>{assert.equal(url,CAREERS_URL);const p=get(url);return {status:p.status,url:p.url,html:p.body}},
 fetchJson:async url=>change(url,JSON.parse(get(url).body)),
})
test('Hoonartek withholds a native open role whose original criteria are empty and marks incomplete native coverage',async()=>{
 const jobs=await run(options())
 assert.equal(jobs.length,7)
 assert.ok(!jobs.some(job=>job.jobId==='55414'))
 assert.ok(jobs.every(job=>job.jobDescription.length>100&&job.country==='India'))
 const proof=readInventoryEvidence(jobs)
 assert.equal(proof.status,'coverage-gap');assert.equal(proof.listingComplete,false)
 assert.match(proof.reason,/55414/)
 assert.match(proof.reason,/44/)
})
test('Hoonartek rejects a mismatched empty-criteria role instead of treating its identity as verified',async()=>{
 await assert.rejects(run(options((url,payload)=>url===buildJobDetailApiUrl('55414')?{...payload,id:99999}:payload)),/detail payload/)
})
