import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-page-contract-20261031.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
test('current captured first-party homepage, careers and explore native contract already pass without a production repair',()=>{
 assert.equal(source.hasOfficialHomepageSignal(packets[0].body),true)
 assert.equal(source.hasOfficialCareersSignal(packets[1].body),true)
 assert.equal(source.hasOfficialExploreJobsSignal(packets[2].body),true)
 const listings=source.extractListingCards(packets[2].body)
 assert.equal(listings.length,19);assert.equal(new Set(listings.map(row=>row.sourceUrl)).size,19)
 assert.ok(listings.every(row=>/\bIndia\b/.test(row.location)&&new URL(row.sourceUrl).origin==='https://www.apexon.com'))
 assert.ok(packets.slice(3).every(packet=>source.hasOfficialDetailPageSignal(packet.body)))
})
test('registered default replay retains eight verified roles at the recorded offline boundary',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async url=>{calls.push(String(url));const packet=packets.find(row=>row.url===String(url));if(!packet)throw Object.assign(Error('Offline capture boundary: remaining role details were not fetched'),{abortRetries:true});const response=new Response(packet.body,{status:packet.status});Object.defineProperty(response,'url',{value:packet.finalUrl});return response})
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source===source.SOURCE)).run()
 assert.equal(jobs.length,8)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.match(jobs[0].nativeCollectionFailures[0].reason,/Offline capture boundary/)
 assert.equal(calls.length,12)
})
