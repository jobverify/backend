import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Axelor scraper with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const axelor = catalog.find((provider) => provider.source === 'axelor')

  assert.ok(axelor)
  assert.equal(axelor.adapter, 'script')
  assert.equal(axelor.atsPlatform, 'official-company-careers')
  assert.match(axelor.companyCareerPage, /axelor\.com\/job-offers/i)
  assert.equal(axelor.companyDomain, 'axelor.com')
})

test('buildScrapers exposes a runnable Axelor scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const axelor = scrapers.find((scraper) => scraper.name === 'axelor')

  assert.ok(axelor)
  assert.equal(typeof axelor.run, 'function')
  assert.match(axelor.dryRunFile, /axelor[\\/]jobs\.json$/)
  assert.equal(axelor.provider.source, 'axelor')
  assert.equal(axelor.provider.adapter, 'script')
})
