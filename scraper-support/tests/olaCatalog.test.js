import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog,createCatalogScraper,buildScrapers } from '../providers/index.js'
import { nativeOptions } from '../../scraper/ola/fixtures/options.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

for(const source of ['ola','olaelectric'])test('registered '+source+' runs its source-local native workflow and preserves partial live inventory evidence',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Hermetic catalog test attempted network')})
  const matches=getScraperCatalog().filter(p=>p.source===source)
  assert.equal(matches.length,1)
  const p=matches[0]
  assert.equal(p.adapter,'script');assert.equal(p.catalogOverride,true);assert.equal(p.atsPlatform,'turbohire')
  assert.equal(p.sourceScopeComplete,false);assert.equal(p.lifecycleCleanupAllowed,false)
  assert.equal(p.verifiedNativeBoardCount,0);assert.equal(p.nativeBoardCountKnown,true)
  let native
  const jobs=await createCatalogScraper(p).run({...nativeOptions({source}),onEvidence:e=>{native=e}})
  assert.equal(jobs.length,0);assert.equal(native.source,source);assert.equal(native.nativeBoardComplete,true)
  assert.equal(native.nativeBoardEmpty,true);assert.equal(native.observedGlobalRecords,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  const wrapper=buildScrapers().find(s=>s.name===source)
  assert.equal(typeof wrapper.run,'function');assert.match(wrapper.dryRunFile,new RegExp(source+'[\\\\/]jobs\\.json$'))
})
