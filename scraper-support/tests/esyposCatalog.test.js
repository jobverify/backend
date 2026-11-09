import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes ESYPOS as a verified broken exact-match host scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'esypos')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-broken-no-public-job-listings')
  assert.equal(provider.companyCareerPage, 'http://esypos.in/careers')
  assert.equal(provider.companyDomain, 'esypos.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /esypos[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable ESYPOS scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'esypos')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
})
