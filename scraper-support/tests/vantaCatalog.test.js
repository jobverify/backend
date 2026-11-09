import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=async()=>{throw Error('NETWORK_TRIPWIRE_BEFORE_SOURCE_IMPORT')}
const {getScraperCatalog,createCatalogScraper}=await import('../providers/index.js')
const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const {fixture,transport}=await import('../../scraper/checkoutcom/native.fixtures.js')

test('Vanta registered catalog follows its current native client and reconciles foreign full details',async()=>{
  const provider=getScraperCatalog().find(p=>p.source==='vanta')
  const jobs=await createCatalogScraper(provider).run(transport('vanta',[fixture('vanta',{country:'USA',location:'Remote U.S.'})]))
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,1)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
})

test('Vanta local catalog and registered wrapper use the same native extraction',async()=>{
  const {VANTA_CATALOG}=await import('../../scraper/vanta/catalog.js')
  const jobs=await createCatalogScraper(VANTA_CATALOG).run(transport('vanta'))
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].jobId,'10000000-0000-4000-8000-000000000001')
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
