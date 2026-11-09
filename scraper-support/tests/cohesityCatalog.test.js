import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Cohesity as a first-party open-positions API scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'cohesity')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.cohesity.com/careers/open-positions/')
  assert.equal(provider.companyDomain, 'cohesity.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /cohesity[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Cohesity scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'cohesity')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.cohesity.com/careers/open-positions/')
})
