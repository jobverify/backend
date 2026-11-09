import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Bahwan CyberTek RippleHire script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'bahwancybertek')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.match(provider.companyCareerPage, /bahwancybertek\.ripplehire\.com\/candidate\/careers/i)
})

test('buildScrapers exposes a runnable Bahwan CyberTek scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const scraper = scrapers.find((item) => item.name === 'bahwancybertek')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /bahwancybertek[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'bahwancybertek')
})
