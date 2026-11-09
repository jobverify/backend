import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=async()=>{throw Error('NETWORK_TRIPWIRE_BEFORE_SOURCE_IMPORT')}
const {getScraperCatalog,createCatalogScraper}=await import('../providers/index.js')
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const {fixture,transport}=await import('../../scraper/checkoutcom/native.fixtures.js')
const run=io=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='vanta')).run(io)

test('Vanta ignores hidden legacy Webflow empty-state text and extracts native full criteria',async()=>{
 const jobs=await run(transport('vanta'))
 assert.equal(jobs.length,1)
 assert.match(jobs[0].jobDescription,/5\+ years building C\+\+/)
 assert.match(jobs[0].minimumQualification,/identity systems/)
 assert.equal(jobs[0].postingDate,'2026-10-20T12:34:56.789+00:00')
 assert.equal(jobs[0].closingDate,'2026-11-30T23:59:00.000Z')
})

test('Vanta city-only worksite without a qualified state or country remains an unverified zero',async()=>{
 const jobs=await run(transport('vanta',[fixture('vanta',{country:null,location:'Denver'})]))
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
