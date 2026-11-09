import assert from 'node:assert/strict'
import test from 'node:test'
import {original,transport,HOME,SEARCH} from './native.fixtures.js'
globalThis.fetch=()=>{throw Error('OFFLINE AutoForm test network tripwire')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const run=io=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='autoformindia')).run({now:()=> '2026-10-27T10:00:00Z',...io})

test('retained October native roles keep the exact foreign-country conflict while proving configured India zero',async()=>{
 let audit
 const jobs=await run({...transport(),onAudit:a=>audit=a})
 assert.ok(audit,'registered source must inspect native detail fields')
 assert.equal(audit.nativeJobs.length,5)
 assert.equal(audit.nativeJobs.filter(j=>j.sourceDetailComplete).length,4)
 const role=audit.nativeJobs.find(j=>j.jobId==='5162')
 assert.equal(role.requisitionId,'26/16/pts')
 assert.equal(role.legalEmployer,'AutoForm Engineering GmbH')
 assert.equal(role.country,'Switzerland')
 assert.equal(role.postingDate,'2026-10-13T14:33:28.000Z')
 assert.equal(role.nativeSchemaDatePosted,'2026-10-13T16:33')
 assert.match(role.jobDescription,/Your Responsibilities/)
 assert.match(role.applyUrl,/jobid=5162/)
 const conflict=audit.nativeJobs.find(j=>j.jobId==='5150')
 assert.equal(conflict.country,null)
 assert.equal(conflict.sourceCountryConflict,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(audit.companyComplete,false)
 assert.equal(audit.wholeCompanyGlobal,null)
 assert.equal(jobs.length,0)
})

test('timeout is unknown inventory and stops at its first route',async()=>{
 const io=transport(null,{failure:Object.assign(Error('Connect timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'})})
 await assert.rejects(run(io),/timeout/i)
 assert.deepEqual(io.calls,[HOME])
})

for(const status of [401,403,429])test(`HTTP${status} stops immediately without empty inventory or an alternate route`,async()=>{
 const io=transport(null,{onResponse:page=>{page.status=status;page.body='Denied'}})
 await assert.rejects(run(io),new RegExp(String(status)))
 assert.deepEqual(io.calls,[HOME])
})

test('loss of current corporate hiring handoff fails before listing work',async()=>{
 const io=transport(pages=>{pages[HOME].body=pages[HOME].body.replaceAll('https://careers.autoform.com/en/','https://example.com/other/')})
 await assert.rejects(run(io),/corporate|handoff|employer/i)
 assert.deepEqual(io.calls,[HOME])
})
