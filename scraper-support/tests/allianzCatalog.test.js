import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Allianz Phenom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const allianz = catalog.find((provider) => provider.source === 'allianz')

  assert.ok(allianz)
  assert.equal(allianz.adapter, 'script')
  assert.equal(allianz.atsPlatform, 'phenom')
  assert.match(allianz.companyCareerPage, /careers\.allianz\.com/i)
  assert.equal(allianz.companyDomain, 'careers.allianz.com')
  assert.match(allianz.modulePath, /allianz[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Allianz scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const allianz = scrapers.find((scraper) => scraper.name === 'allianz')

  assert.ok(allianz)
  assert.equal(typeof allianz.run, 'function')
  assert.match(allianz.dryRunFile, /allianz[\\/]jobs\.json$/)
  assert.equal(allianz.provider.source, 'allianz')
  assert.equal(allianz.provider.atsPlatform, 'phenom')
})
