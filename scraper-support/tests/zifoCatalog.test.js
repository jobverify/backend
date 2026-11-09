import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Zifo with the current Workable published feed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'zifo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workable')
  assert.equal(provider.companyName, 'Zifo RnD Solutions')
  assert.equal(provider.officialBrandName, 'Zifo')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyCareerPage, 'https://careers.zifo.com/')
  assert.equal(provider.companyDomain, 'careers.zifo.com')
  assert.match(provider.modulePath, /zifo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Zifo scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'zifo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /zifo[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'zifo')
  assert.equal(scraper.provider.atsPlatform, 'workable')
})
