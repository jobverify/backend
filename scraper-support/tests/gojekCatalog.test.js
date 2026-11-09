import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes the Gojek checkpointed-board script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const gojek = catalog.find((provider) => provider.source === 'gojek')

  assert.ok(gojek)
  assert.equal(gojek.adapter, 'script')
  assert.equal(gojek.atsPlatform, 'official-company-careers')
  assert.match(gojek.companyCareerPage, /gojek\.io\/careers/i)
  assert.equal(gojek.companyDomain, 'gojek.io')
  assert.equal(gojek.parser, 'custom-script')
  assert.match(gojek.modulePath, /gojek[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gojek script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const gojek = scrapers.find((scraper) => scraper.name === 'gojek')

  assert.ok(gojek)
  assert.equal(typeof gojek.run, 'function')
  assert.equal(gojek.provider.adapter, 'script')
  assert.equal(gojek.provider.parser, 'custom-script')
  assert.match(gojek.provider.companyCareerPage, /gojek\.io\/careers/i)
})
