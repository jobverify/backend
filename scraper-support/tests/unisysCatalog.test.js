import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Unisys on the official careers page backed by Workday', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'unisys')

  assert.ok(provider)
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.companyName, 'Unisys')
  assert.equal(provider.companyCareerPage, 'https://www.unisys.com/careers/')
  assert.equal(provider.companyDomain, 'unisys.com')
  assert.equal(provider.locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.baseUrl, /unisys\.wd5\.myworkdayjobs\.com\/External/i)
})

test('buildScrapers exposes a runnable Unisys Workday scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'unisys')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /unisys.workday[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'unisys')
  assert.equal(scraper.provider.atsPlatform, 'workday')
})
