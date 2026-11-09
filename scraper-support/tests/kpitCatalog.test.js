import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the KPIT custom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const kpit = catalog.find((provider) => provider.source === 'kpit')

  assert.ok(kpit)
  assert.equal(kpit.adapter, 'script')
  assert.equal(kpit.atsPlatform, 'talentojo')
  assert.match(kpit.companyCareerPage, /kpit\.com\/careers/i)
  assert.equal(kpit.companyDomain, 'kpit.com')
})

test('buildScrapers exposes a runnable KPIT script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const kpit = scrapers.find((scraper) => scraper.name === 'kpit')

  assert.ok(kpit)
  assert.equal(typeof kpit.run, 'function')
  assert.match(kpit.dryRunFile, /kpit[\\/]jobs\.json$/)
  assert.equal(kpit.provider.source, 'kpit')
  assert.equal(kpit.provider.atsPlatform, 'talentojo')
})
