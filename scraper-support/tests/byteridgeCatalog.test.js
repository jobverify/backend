import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
  createCatalogScraper,
} from '../providers/index.js'
import { nativeOptions } from '../../scraper/byteridge/fixtures/options.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('getScraperCatalog includes Byteridge with its public careers page metadata', () => {
  const catalog = getScraperCatalog()
  const byteridge = catalog.find((provider) => provider.source === 'byteridge')

  assert.ok(byteridge)
  assert.equal(byteridge.adapter, 'script')
  assert.equal(byteridge.atsPlatform, 'turbohire')
  assert.equal(byteridge.companyCareerPage, 'https://byteridge.com/careers/')
  assert.equal(byteridge.companyDomain, 'byteridge.com')
})

test('registered Byteridge source extracts the current public native seven-role inventory', async t => {
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Hermetic catalog test attempted network')})
  const provider=getScraperCatalog().find(p=>p.source==='byteridge')
  const jobs=await createCatalogScraper(provider).run(nativeOptions())
  assert.equal(jobs.length,7)
  assert.equal(jobs[0].jobId,'34756b57-fd21-4591-b34c-6e2c91cb7f02')
  assert.equal(jobs[0].companyCareerPage,'https://byteridge.com/careers/')
  assert.equal(jobs[0].companyDomain,'byteridge.com')
  assert.equal(jobs[0].atsPlatform,'turbohire')
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('buildScrapers exposes a runnable Byteridge scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const byteridge = scrapers.find((scraper) => scraper.name === 'byteridge')

  assert.ok(byteridge)
  assert.equal(typeof byteridge.run, 'function')
  assert.match(byteridge.dryRunFile, /byteridge[\\/]jobs\.json$/)
  assert.equal(byteridge.provider.source, 'byteridge')
  assert.equal(byteridge.provider.adapter, 'script')
})
