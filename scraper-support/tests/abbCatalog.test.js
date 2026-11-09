import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ABB on the official ABB careers page backed by the Phenom search surface', () => {
  const catalog = getScraperCatalog()
  const abb = catalog.find((provider) => provider.source === 'abb')

  assert.ok(abb)
  assert.equal(abb.adapter, 'script')
  assert.equal(abb.atsPlatform, 'phenom')
  assert.match(abb.companyCareerPage, /careers\.abb\/global\/en\/search-results/i)
  assert.equal(abb.companyDomain, 'careers.abb')
  assert.match(abb.baseUrl, /abb\.wd3\.myworkdayjobs\.com\/External_Career_Page/i)
  assert.match(abb.modulePath, /abb\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ABB Phenom scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const abb = scrapers.find((scraper) => scraper.name === 'abb')

  assert.ok(abb)
  assert.equal(typeof abb.run, 'function')
  assert.match(abb.dryRunFile, /abb.workday[\\/]jobs\.json$/)
  assert.equal(abb.provider.source, 'abb')
  assert.equal(abb.provider.atsPlatform, 'phenom')
})
