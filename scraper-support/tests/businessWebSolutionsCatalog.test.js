import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Business Web Solutions official India careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'businesswebsolutions')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Business Web Solutions')
  assert.equal(provider.companyCareerPage, 'https://businesswebsolutions.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
})

test('buildScrapers exposes a runnable Business Web Solutions scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'businesswebsolutions')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /businesswebsolutions[\\/]jobs\.json$/)
})
