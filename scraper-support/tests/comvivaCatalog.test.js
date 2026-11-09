import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Comviva as a CEIPAL widget scraper', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'comviva')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ceipal-widget')
  assert.equal(provider.companyCareerPage, 'https://www.comviva.com/careers/explore-opportunity/')
  assert.equal(provider.companyDomain, 'comviva.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /comviva[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Comviva scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'comviva')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.parser, 'custom-script')
  assert.equal(provider.provider.companyCareerPage, 'https://www.comviva.com/careers/explore-opportunity/')
})
