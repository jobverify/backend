import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the South Indian Bank RDC script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'southindianbank')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.companyCareerPage, /southindianbank\.bank\.in\/about-us\/careers/i)
  assert.equal(provider.companyDomain, 'southindianbank.bank.in')
})

test('buildScrapers exposes a runnable South Indian Bank scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'southindianbank')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /southindianbank[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'southindianbank')
})
