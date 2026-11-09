import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes EPIKInDiFi as an official empty careers stub scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'epikindifi')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-job-listings')
  assert.equal(provider.companyCareerPage, 'https://epikindifi.com/careers/')
  assert.equal(provider.companyDomain, 'epikindifi.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /epikindifi[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable EPIKInDiFi scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'epikindifi')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
})
