import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
const extension = () => JSON.parse(fs.readFileSync(new URL('../scraper-support/providers/providerExtensions/zzzzzzzzzzzz-verified-discovery-adapters-007.json',import.meta.url)))
test('activates only the safe exact BlueCat binding and keeps discovery counts unknown',()=>{
  const entries=extension()
  assert.deepEqual(entries.map(e=>e.source),['bluecat'])
  const row=entries[0]
  assert.equal(row.adapter,'script')
  assert.equal(row.atsPlatform,'lever')
  assert.equal(row.boardToken,'bluecatnetworks')
  assert.equal(row.bindingEvidence.verified,true)
  assert.ok(row.bindingEvidence.matchedLinks.includes('https://jobs.lever.co/bluecatnetworks/'))
  assert.equal(row.verifiedPublicJobCount,null)
  assert.equal(row.verifiedIndiaJobCount,null)
  assert.equal(row.verifiedInventoryStatus,'unverified')
})
test('preserves exact source identities and does not promote the unavailable Boatsetter tenant',()=>{
  extension()
  const catalog=getScraperCatalog()
  assert.equal(catalog.filter(row=>row.source==='bluecat').length,1);assert.equal(catalog.filter(row=>row.source==='boatsetter').length,1);assert.equal(catalog.filter(r=>r.boardToken==='bluecatnetworks').length,1)
  const bluecat=catalog.find(r=>r.source==='bluecat')
  assert.equal(bluecat.adapter,'script')
  assert.equal(bluecat.atsPlatform,'lever')
  assert.match(bluecat.modulePath.replaceAll('\\','/'),/scraper\/bluecat\/script\.js$/)
  assert.equal(catalog.find(r=>r.source==='boatsetter').adapter,'script')
})
