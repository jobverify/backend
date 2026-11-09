import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the AllGoVision scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const allgovision = catalog.find((provider) => provider.source === 'allgovision')

  assert.ok(allgovision)
  assert.equal(allgovision.adapter, 'script')
  assert.equal(allgovision.atsPlatform, 'official-company-careers')
  assert.match(allgovision.companyCareerPage, /allgovision\.com\/career\.php/i)
  assert.equal(allgovision.companyDomain, 'allgovision.com')
})

test('buildScrapers exposes a runnable AllGoVision scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const allgovision = scrapers.find((scraper) => scraper.name === 'allgovision')

  assert.ok(allgovision)
  assert.equal(typeof allgovision.run, 'function')
  assert.match(allgovision.dryRunFile, /allgovision[\\/]jobs\.json$/)
  assert.equal(allgovision.provider.source, 'allgovision')
  assert.equal(allgovision.provider.adapter, 'script')
})
