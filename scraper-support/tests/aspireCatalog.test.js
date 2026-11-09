import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Aspire Systems scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const aspiresystems = catalog.find((provider) => provider.source === 'aspiresystems')

  assert.ok(aspiresystems)
  assert.equal(aspiresystems.adapter, 'script')
  assert.equal(aspiresystems.atsPlatform, 'drupal-openings')
  assert.match(aspiresystems.companyCareerPage, /aspiresys\.com\/openings\?country=IN/i)
  assert.equal(aspiresystems.companyDomain, 'aspiresys.com')
})

test('buildScrapers exposes a runnable Aspire Systems scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aspiresystems = scrapers.find((scraper) => scraper.name === 'aspiresystems')

  assert.ok(aspiresystems)
  assert.equal(typeof aspiresystems.run, 'function')
  assert.match(aspiresystems.dryRunFile, /aspiresystems[\\/]jobs\.json$/)
  assert.equal(aspiresystems.provider.source, 'aspiresystems')
  assert.equal(aspiresystems.provider.adapter, 'script')
})
