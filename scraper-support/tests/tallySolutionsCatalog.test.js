import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Tally Solutions script provider with official careers metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'tallysolutions')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /tallysolutions\.com\/careers\/opportunities/i)
})

test('buildScrapers exposes a runnable Tally Solutions scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'tallysolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /tallysolutions[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'tallysolutions')
})
