import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes IPR Technologies as a no-public-careers scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'iprtechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site')
  assert.equal(provider.companyCareerPage, 'https://iprtechnologies.com/')
  assert.equal(provider.companyDomain, 'iprtechnologies.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /iprtechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IPR Technologies scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'iprtechnologies')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://iprtechnologies.com/')
})
