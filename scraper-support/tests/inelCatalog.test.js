import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes INEL as a structured-data careers scraper', () => {
  const catalog = getScraperCatalog()
  const inel = catalog.find((provider) => provider.source === 'inel')

  assert.ok(inel)
  assert.equal(inel.adapter, 'script')
  assert.equal(inel.atsPlatform, 'official-company-careers')
  assert.equal(inel.companyCareerPage, 'https://indianippon.com/career')
  assert.equal(inel.companyDomain, 'indianippon.com')
  assert.equal(inel.parser, 'custom-script')
  assert.match(inel.modulePath, /inel[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable INEL script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const inel = scrapers.find((scraper) => scraper.name === 'inel')

  assert.ok(inel)
  assert.equal(typeof inel.run, 'function')
  assert.equal(inel.provider.adapter, 'script')
  assert.equal(inel.provider.parser, 'custom-script')
  assert.equal(inel.provider.companyCareerPage, 'https://indianippon.com/career')
})
