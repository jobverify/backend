import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Infineon Eightfold apiPortal provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const infineon = catalog.find((provider) => provider.source === 'infineon')

  assert.ok(infineon)
  assert.equal(infineon.adapter, 'apiPortal')
  assert.equal(infineon.atsPlatform, 'eightfold')
  assert.equal(infineon.companyName, 'Infineon')
  assert.equal(infineon.companyDomain, 'infineon.com')
  assert.match(infineon.companyCareerPage, /jobs\.infineon\.com\/careers/i)
  assert.match(infineon.config.discovery.listingApiUrl, /jobs\.infineon\.com\/api\/pcsx\/search/i)
})

test('buildScrapers exposes a runnable Infineon apiPortal scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const infineon = scrapers.find((scraper) => scraper.name === 'infineon')

  assert.ok(infineon)
  assert.equal(typeof infineon.run, 'function')
  assert.match(infineon.dryRunFile, /infineon[\\/]jobs\.json$/)
  assert.equal(infineon.provider.source, 'infineon')
  assert.equal(infineon.provider.atsPlatform, 'eightfold')
})
