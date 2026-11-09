import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Prop Times as a no-public-host scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'proptimes')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://proptimes.com/')
  assert.equal(provider.companyDomain, 'proptimes.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /proptimes[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Prop Times scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'proptimes')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://proptimes.com/')
})
