import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Clix Capital Darwinbox-backed script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const clixcapital = catalog.find((provider) => provider.source === 'clixcapital')

  assert.ok(clixcapital)
  assert.equal(clixcapital.adapter, 'script')
  assert.equal(clixcapital.atsPlatform, 'darwinbox')
  assert.match(clixcapital.companyCareerPage, /clix\.capital\/careers/i)
  assert.equal(clixcapital.companyDomain, 'clix.capital')
  assert.equal(clixcapital.parser, 'custom-script')
  assert.match(clixcapital.modulePath, /clixcapital[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Clix Capital script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const clixcapital = scrapers.find((scraper) => scraper.name === 'clixcapital')

  assert.ok(clixcapital)
  assert.equal(typeof clixcapital.run, 'function')
  assert.equal(clixcapital.provider.adapter, 'script')
  assert.equal(clixcapital.provider.parser, 'custom-script')
  assert.match(clixcapital.provider.companyCareerPage, /clix\.capital\/careers/i)
})
