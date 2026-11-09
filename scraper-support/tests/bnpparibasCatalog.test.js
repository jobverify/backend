import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the BNP Paribas public careers scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bnpparibas')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /group\.bnpparibas\/en\/careers\/all-job-offers\/bnp-paribas-india-solutions/i)
})

test('buildScrapers exposes a runnable BNP Paribas scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'bnpparibas')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bnpparibas[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bnpparibas')
})
