import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Schneider Electric API script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const schneiderElectric = catalog.find((provider) => provider.source === 'schneiderelectric')

  assert.ok(schneiderElectric)
  assert.equal(schneiderElectric.adapter, 'script')
  assert.equal(schneiderElectric.atsPlatform, 'icims')
  assert.equal(schneiderElectric.companyName, 'Schneider Electric')
  assert.equal(schneiderElectric.companyCareerPage, 'https://careers.se.com/jobs?lang=en-US')
  assert.equal(schneiderElectric.companyDomain, 'careers.se.com')
  assert.match(schneiderElectric.modulePath, /schneiderelectric[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Schneider Electric scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const schneiderElectric = scrapers.find((scraper) => scraper.name === 'schneiderelectric')

  assert.ok(schneiderElectric)
  assert.equal(typeof schneiderElectric.run, 'function')
  assert.match(schneiderElectric.dryRunFile, /schneiderelectric[\\/]jobs\.json$/)
  assert.equal(schneiderElectric.provider.source, 'schneiderelectric')
  assert.equal(schneiderElectric.provider.atsPlatform, 'icims')
})
