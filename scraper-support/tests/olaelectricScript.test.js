import assert from 'node:assert/strict'
import test from 'node:test'
import { createOlaElectricScraper,run } from '../../scraper/olaelectric/script.js'
import { nativeOptions } from '../../scraper/ola/fixtures/options.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Ola Electric forwards caller options and retains its independent source identity',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Hermetic OlaElectric test attempted network')})
  const jobs=await run(nativeOptions({source:'olaelectric'}))
  assert.equal(jobs.nativeInventoryEvidence.source,'olaelectric')
  assert.equal(jobs.nativeInventoryEvidence.surface,'https://www.olaelectric.com/careers')
  assert.equal(jobs.nativeInventoryEvidence.reportedTotal,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(typeof createOlaElectricScraper().run,'function')
})
