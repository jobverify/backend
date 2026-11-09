import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Trianz as an official careers-page monitor source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'trianz')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Trianz')
  assert.equal(provider.companyCareerPage, 'https://www.trianz.com/careers')
  assert.equal(provider.paginationStrategy, 'official-page-plus-unreachable-india-handoff-monitor')
})

test('buildScrapers exposes a runnable Trianz monitor without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'trianz')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /trianz[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'trianz')
})
