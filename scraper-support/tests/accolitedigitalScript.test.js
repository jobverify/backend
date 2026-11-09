import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractSearchResults,run,TURBOHIRE_ENDPOINT} from '../../scraper/accolitedigital/script.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readInventoryDelegationEvidence} from '../utils/inventoryDelegationEvidence.js'
const pages=new Map(['bounteous','accolitedigital'].flatMap(source=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/'+source+'/test-data/native-20261103.json.gz',import.meta.url))))).map(row=>[row.requestedUrl,row]))
test('Accolite legacy parser recognizes the current combined brand without obsolete department filtering',()=>{
 const jobs=extractSearchResults(JSON.parse(pages.get(TURBOHIRE_ENDPOINT).body))
 assert.equal(jobs.length,69);assert.ok(jobs.every(job=>job.company==='Bounteous'&&job.source==='bounteous'))
 assert.equal(readInventoryDelegationEvidence(jobs),null)
})
test('registered historical Accolite export forwards options through one canonical collector',async()=>{
 let audit
 const jobs=await run({maxJobs:1,fetchPage:async url=>({...structuredClone(pages.get(url)),capturedAt:new Date().toISOString()}),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,1);assert.equal(audit.source,'accolitedigital');assert.equal(audit.canonicalSource,'bounteous')
 assert.equal(audit.observedListingCount,109);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(readInventoryDelegationEvidence(jobs).sources,['bounteous'])
})
