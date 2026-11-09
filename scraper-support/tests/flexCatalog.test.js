import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Flex as a Workday-backed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'flex')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://flex.com/careers')
  assert.equal(provider.companyDomain, 'flex.com')
  assert.match(provider.modulePath, /flex\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Flex scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'flex')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'workday')
  assert.match(provider.dryRunFile, /flex.workday[\\/]jobs\.json$/)
})
