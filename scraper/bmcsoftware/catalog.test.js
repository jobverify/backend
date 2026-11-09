import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readFileSync} from 'node:fs'

test('BMC keeps its single existing source with current official India handoff and runtime-only counts',async()=>{
  const catalog=getScraperCatalog(),matches=catalog.filter(row=>row.source==='bmcsoftware')
  assert.equal(matches.length,1)
  const provider=matches[0]
  assert.equal(provider.backfillMode,'live-parser')
  assert.equal(provider.zeroResultPolicy,'evidence-required')
  assert.equal(provider.verifiedPublicJobCount,null)
  assert.equal(provider.verifiedIndiaJobCount,null)
  assert.equal(provider.bindingEvidence.verified,true)
  const root=new URL('./fixtures/',import.meta.url),proof=JSON.parse(readFileSync(new URL('provenance.json',root),'utf8'))
  const bodies=new Map(proof.receipts.map(row=>[row.requestedURL,readFileSync(new URL(row.fixture,root),'utf8')]))
  const jobs=await createCatalogScraper(provider).run({fetchText:async url=>{
    assert.ok(bodies.has(url));return bodies.get(url)
  }})
  assert.equal(jobs.length,25)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,25)
})
