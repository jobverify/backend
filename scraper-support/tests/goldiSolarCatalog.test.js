import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Goldi Solar intake scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const goldi = catalog.find((provider) => provider.source === 'goldisolar')

  assert.ok(goldi)
  assert.equal(goldi.adapter, 'script')
  assert.equal(goldi.atsPlatform, 'official-company-careers')
  assert.match(goldi.companyCareerPage, /goldisolar\.com\/career/i)
  assert.equal(goldi.companyDomain, 'goldisolar.com')
})

test('buildScrapers exposes a runnable Goldi Solar scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const goldi = scrapers.find((scraper) => scraper.name === 'goldisolar')

  assert.ok(goldi)
  assert.equal(typeof goldi.run, 'function')
  assert.match(goldi.dryRunFile, /goldisolar[\\/]jobs\.json$/)
  assert.equal(goldi.provider.source, 'goldisolar')
  assert.equal(goldi.provider.atsPlatform, 'official-company-careers')
})
