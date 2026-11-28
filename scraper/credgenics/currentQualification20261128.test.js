import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCredgenicsScraper,ZAPPYHIRE_API_BASE} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

// These are explicit mutations of genuine observations, not newly observed jobs.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-publisher-20261128.json.gz',import.meta.url))))
const bodies=new Map()
for(const packet of fixture.packets){const url=packet.requestedUrl??packet.url;if(!bodies.has(url))bodies.set(url,Buffer.from(packet.bodyBase64,'base64').toString())}
const listing=ZAPPYHIRE_API_BASE+'jobs/jobsearch/?page=1&page_size=100'
const firstID=JSON.parse(bodies.get(listing)).results.hits[0]._source.job
const detailURL=ZAPPYHIRE_API_BASE+'careers/jobs/'+firstID+'/'
const outputID=job=>String(job.requisitionId??job.jobId)
const actualIN=(url,value)=>{if(/\/careers\/jobs\/\d+\/$/.test(url))for(const place of value.results.location)place.country_code='IN';return value}
const replay=mutate=>createCredgenicsScraper().run({
 now:()=>fixture.registeredCapture.sourceNow,
 fetchText:async url=>{assert.ok(bodies.has(url));return bodies.get(url)},
 fetchJson:async url=>{assert.ok(bodies.has(url));return mutate(url,actualIN(url,JSON.parse(bodies.get(url))))},
})
const held=jobs=>{
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
}

for(const flag of[true,'true',1,null,0,[],{},undefined])test('present unreviewed or vendor employer marker remains held: '+String(flag),async()=>{
 const jobs=await replay((url,value)=>{if(url===detailURL)value.results.is_vendor_job=structuredClone(flag);return value})
 assert.equal(jobs.length,8);assert.equal(jobs.some(job=>outputID(job)===String(firstID)),false)
 const row=jobs.nativeCollectionEvidence.opening.records.find(item=>item.detail.id===firstID)
 assert.equal(row.job,null);assert.deepEqual(row.detail.is_vendor_job,flag);assert.equal(row.reason,'native-employer-unqualified');held(jobs)
})

for(const [label,change]of[
 ['source country',page=>{page.results.hits[0]._source.country_code='US'}],
 ['source applicant alternatives',page=>{page.results.hits[0]._source.applicantLocationRequirements={country:'US'}}],
 ['source vendor marker',page=>{page.results.hits[0]._source.is_vendor_job=true}],
 ['source eligibility',page=>{page.results.hits[0]._source.eligibility={country:'US'}}],
 ['hit country',page=>{page.results.hits[0].country='US'}],
 ['hit employer',page=>{page.results.hits[0].vendor=true}],
 ['source location type',page=>{page.results.hits[0]._source.location=['Noida','United States']}],
 ['source industry type',page=>{page.results.hits[0]._source.industry={country:'US'}}],
 ['foreign listing location',page=>{page.results.hits[0]._source.location='United States'}],
 ['mixed listing locations',page=>{page.results.hits[0]._source.location='Noida,United States'}],
])test('new or conflicting listing information holds its complete raw native role: '+label,async()=>{
 let raw
 const jobs=await replay((url,value)=>{if(url===listing){change(value);raw=structuredClone(value.results.hits[0])}return value})
 assert.equal(jobs.length,8);assert.equal(jobs.some(job=>outputID(job)===String(firstID)),false)
 const row=jobs.nativeCollectionEvidence.opening.records[0];assert.deepEqual(row.record,raw);assert.equal(row.job,null);held(jobs)
})

for(const [label,change]of[
 ['envelope geography',page=>{page.country='US'}],
 ['results geography',page=>{page.results.applicantCountries=['US']}],
 ['total eligibility',page=>{page.results.total.country='US'}],
 ['inexact total relation',page=>{page.results.total.relation='gte'}],
 ['unreviewed errors shape',page=>{page.errors={country:'US'}}],
 ['unreviewed max-score shape',page=>{page.results.max_score={country:'US'}}],
])test('unreviewed listing-envelope qualification holds all rows without losing raw data: '+label,async()=>{
 let raw
 const jobs=await replay((url,value)=>{if(url===listing){change(value);raw=structuredClone(value)}return value})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.opening.records.length,9)
 assert.deepEqual(jobs.nativeCollectionEvidence.opening.listingPages[0],raw)
 assert.ok(jobs.nativeCollectionEvidence.opening.records.every(row=>row.job===null));held(jobs)
})

test('reviewed false marker and correlated listing city set preserve nine explicit-IN observations',async()=>{
 const jobs=await replay((url,value)=>value)
 assert.equal(jobs.length,9);held(jobs)
 for(const row of jobs.nativeCollectionEvidence.opening.records){assert.equal(row.detail.is_vendor_job,false);assert.ok(row.job);assert.equal(row.job.sourceDetailComplete,false)}
})

test('reviewed legacy missing optional vendor and Elasticsearch metadata remain compatible',async()=>{
 const jobs=await replay((url,value)=>{
  if(url===listing){delete value.errors;delete value.results.departments;delete value.results.max_score;delete value.results.total.relation;for(const hit of value.results.hits){for(const key of Object.keys(hit))if(key!=='_source')delete hit[key];delete hit._source.industry}}
  if(/\/careers\/jobs\/\d+\/$/.test(url))delete value.results.is_vendor_job
  return value
 })
 assert.equal(jobs.length,9);held(jobs)
})
