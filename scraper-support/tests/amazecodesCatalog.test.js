import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes AMAZECODES as a LinkedIn guest-search scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'amazecodes')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/amazecodes-solutions-pvt-ltd/')
  assert.equal(provider.companyDomain, 'amazecodes.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /amazecodes[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable AMAZECODES scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'amazecodes')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.linkedin.com/company/amazecodes-solutions-pvt-ltd/')
})
