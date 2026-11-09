import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Bounteous with its mixed Lever and TurboHire careers metadata', () => {
  const catalog = getScraperCatalog()
  const bounteous = catalog.find((provider) => provider.source === 'bounteous')

  assert.ok(bounteous)
  assert.equal(bounteous.adapter, 'script')
  assert.equal(bounteous.atsPlatform, 'lever+turbohire')
  assert.equal(bounteous.companyCareerPage, 'https://www.bounteous.com/careers/search-results')
  assert.equal(bounteous.companyDomain, 'bounteous.com')
})

test('buildScrapers exposes a runnable Bounteous scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const bounteous = scrapers.find((scraper) => scraper.name === 'bounteous')

  assert.ok(bounteous)
  assert.equal(typeof bounteous.run, 'function')
  assert.match(bounteous.dryRunFile, /bounteous[\\/]jobs\.json$/)
  assert.equal(bounteous.provider.source, 'bounteous')
  assert.equal(bounteous.provider.adapter, 'script')
})
