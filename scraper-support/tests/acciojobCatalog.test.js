import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AccioJob scraper with public Keka metadata', () => {
  const catalog = getScraperCatalog()
  const acciojob = catalog.find((provider) => provider.source === 'acciojob')

  assert.ok(acciojob)
  assert.equal(acciojob.adapter, 'script')
  assert.equal(acciojob.atsPlatform, 'keka-embed-api')
  assert.match(acciojob.companyCareerPage, /acciojob\.keka\.com\/careers/i)
  assert.equal(acciojob.companyDomain, 'acciojob.com')
})

test('buildScrapers exposes a runnable AccioJob scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const acciojob = scrapers.find((scraper) => scraper.name === 'acciojob')

  assert.ok(acciojob)
  assert.equal(typeof acciojob.run, 'function')
  assert.match(acciojob.dryRunFile, /acciojob[\\/]jobs\.json$/)
  assert.equal(acciojob.provider.source, 'acciojob')
  assert.equal(acciojob.provider.adapter, 'script')
})
