import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-page-contract-20261031.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const landing=packets[0],listing=source.extractSearchResults(JSON.parse(packets[2].body))[0]
test('current official landing advertises its exact already-bound Oracle board directly',()=>assert.equal(source.hasOfficialCareersPageSignal(landing.body),true))
test('registered default HTTP follows current direct native handoff, hydrates one role and retains partial scope',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async(url,init)=>{calls.push(String(url));const packet=packets.find(row=>row.url===String(url));assert.ok(packet,'Only actually captured native request');assert.ok(init.signal instanceof AbortSignal);const response=new Response(packet.body,{status:packet.status});Object.defineProperty(response,'url',{value:packet.finalUrl});return response})
 const jobs=await createCatalogScraper(getScraperCatalog().find(row=>row.source===source.SOURCE)).run({maxPages:1,maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(calls.length,4);assert.ok(!calls.includes(source.SEARCH_CAREERS_URL))
 assert.equal(jobs[0].jobId,'8466');assert.equal(jobs[0].country,'India');assert.ok(jobs[0].jobDescription.length>1000)
 assert.equal(jobs[0].sourceListingComplete,false)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
})
for(const [label,change] of [
 ['other tenant',html=>html.replaceAll('CX_5001','CX_9999')],
 ['foreign host',html=>html.replaceAll('hcfa.fa.us2.oraclecloud.com','foreign.invalid')],
 ['hidden direct handoffs',html=>html.replaceAll('href="'+source.CANDIDATE_EXPERIENCE_URL+'"','hidden href="'+source.CANDIDATE_EXPERIENCE_URL+'"')],
 ['foreign employer title',html=>html.replace('Careers at Amneal India | Join Our Team','Careers at Other Employer | Join Our Team')],
])test('landing rejects '+label,()=>assert.equal(source.hasOfficialCareersPageSignal(change(landing.body)),false))
test('native detail identity and India workplace cannot be supplied by listing fallback or countryFilter',()=>{
 const payload=JSON.parse(packets[3].body)
 for(const change of [{Id:'999999'},{Title:'Unrelated role'},{PrimaryLocationCountry:'US',PrimaryLocation:'Bridgewater, United States'},{PrimaryLocationCountry:null,PrimaryLocation:null}]){
  const altered=structuredClone(payload);Object.assign(altered.items[0],change)
  assert.throws(()=>source.extractJobDetail(altered,listing))
 }
})
test('captured complete native JD retains qualification HTML and excludes hidden role text',()=>{
 const payload=JSON.parse(packets[3].body)
 payload.items[0].ExternalDescriptionStr='<p hidden>FALSE HIDDEN NATIVE REQUIREMENT</p>'+payload.items[0].ExternalDescriptionStr
 const job=source.extractJobDetail(payload,listing)
 assert.ok(job.jobDescription.includes('M. Pharm'))
 assert.ok(job.jobDescription.includes('Preferred'))
 assert.ok(!job.jobDescription.includes('FALSE HIDDEN NATIVE REQUIREMENT'))
})
test('listing teaser and qualification fields cannot replace a missing native role description',()=>{
 const payload=JSON.parse(packets[3].body)
 payload.items[0].ExternalDescriptionStr=''
 payload.items[0].ExternalResponsibilitiesStr=''
 assert.throws(()=>source.extractJobDetail(payload,listing),/native role description/i)
})
