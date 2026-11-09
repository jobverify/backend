import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ABInBev GCC India as a LinkedIn-routed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'abinbevgccindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://www.ab-inbev.com/')
  assert.equal(provider.companyDomain, 'ab-inbev.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /abinbevgccindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ABInBev GCC India scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'abinbevgccindia')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.ab-inbev.com/')
})
