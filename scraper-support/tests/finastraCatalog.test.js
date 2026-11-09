import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Finastra as a Workday-backed script provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'finastra')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyCareerPage, 'https://www.finastra.com/careers/life-at-finastra')
  assert.equal(provider.companyDomain, 'finastra.com')
  assert.match(provider.modulePath, /finastra\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Finastra scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'finastra')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'workday')
  assert.match(provider.dryRunFile, /finastra.workday[\\/]jobs\.json$/)
})
