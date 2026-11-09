import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Sun Mobility as an official careers to LinkedIn guest-search scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'sunmobility')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Sun Mobility')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://www.sunmobility.com/career/')
  assert.equal(provider.companyDomain, 'sunmobility.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /sunmobility[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Sun Mobility scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'sunmobility')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.sunmobility.com/career/')
})
