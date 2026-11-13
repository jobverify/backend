import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {greenhouseLocationSegments,selectGreenhouseLocation} from '../utils/greenhouseLocations.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const payload=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-contracts-20261113/entrupy-jobs.json.gz',import.meta.url))))
const alternatives='Bulgaria, Poland, Romania, Austria, Hungary or India'

test('explicit native country alternatives select India without inventing a city',()=>{
 assert.deepEqual(greenhouseLocationSegments(alternatives),['Bulgaria','Poland','Romania','Austria','Hungary','India'])
 assert.equal(selectGreenhouseLocation({location:{name:alternatives}}),'India')
 for(const ambiguous of ['Bangalore, India, United States','India / United States','Bangalore, India or United States'])assert.deepEqual(greenhouseLocationSegments(ambiguous),[ambiguous])
})

test('Entrupy retains all five current India roles including the explicit country alternatives',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='entrupy')
 const jobs=await createCatalogScraper(provider).run({fetchJson:async()=>structuredClone(payload)})
 assert.equal(jobs.length,5)
 const role=jobs.find(j=>String(j.jobId)==='4848260007')
 assert.ok(role)
 assert.equal(role.country,'India')
 assert.equal(role.location,'India')
 assert.equal(role.city,null)
 assert.equal(role.nativeSourceRecord.location.name,alternatives)
 assert.equal(role.nativeDescriptionRaw,payload.jobs.find(j=>j.id===4848260007).content)
 assert.ok(role.jobDescription.length>1000)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeRecords.length,19)
})
