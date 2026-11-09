import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Enel Green Power as an Avature scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const enel = catalog.find((provider) => provider.source === 'enelgreenpower')

  assert.ok(enel)
  assert.equal(enel.adapter, 'script')
  assert.equal(enel.atsPlatform, 'avature')
  assert.match(enel.companyCareerPage, /jobs\.enel\.com\/en_US\/careers\/JobOpenings/i)
  assert.equal(enel.companyDomain, 'jobs.enel.com')
})

test('buildScrapers exposes a runnable Enel Green Power scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const enel = scrapers.find((scraper) => scraper.name === 'enelgreenpower')

  assert.ok(enel)
  assert.equal(typeof enel.run, 'function')
  assert.match(enel.dryRunFile, /enelgreenpower[\\/]jobs\.json$/)
  assert.equal(enel.provider.source, 'enelgreenpower')
  assert.equal(enel.provider.atsPlatform, 'avature')
})
