import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,run,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT} from '../../scraper/bounteous/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const pages=new Map(JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/bounteous/test-data/native-20261103.json.gz',import.meta.url)))).map(row=>[row.requestedUrl,row]))
test('extractSearchResults preserves current native Bounteous employer, full criteria and absent original dates',()=>{
 const jobs=extractSearchResults({leverJobs:JSON.parse(pages.get(LEVER_ENDPOINT).body),turboHirePayload:JSON.parse(pages.get(TURBOHIRE_ENDPOINT).body)})
 assert.equal(jobs.length,69);assert.ok(jobs.every(job=>job.company==='Bounteous'&&job.source==='bounteous'&&job.requisitionId===null&&job.postingDate===null))
 assert.equal(readInventoryEvidence(jobs),null)
})
test('registered Bounteous export forwards runtime limits and current native HTTP observations',async()=>{
 let observed=0,audit
 const jobs=await run({maxJobs:1,fetchPage:async url=>structuredClone(pages.get(url)),onResponse:()=>{observed++},onAudit:value=>{audit=value}})
 assert.equal(jobs.length,1);assert.equal(observed,77);assert.equal(audit.observedListingCount,109)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
