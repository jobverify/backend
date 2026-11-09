import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AXISCADES as an official jobs-page scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'axiscades')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.axiscades.com/jobs/')
  assert.equal(provider.companyDomain, 'axiscades.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /axiscades[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AXISCADES scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'axiscades')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.axiscades.com/jobs/')
})
