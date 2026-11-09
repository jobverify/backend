import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Elastic custom script provider with official metadata', () => {
  const catalog = getScraperCatalog()
  const elastic = catalog.find((provider) => provider.source === 'elastic')

  assert.ok(elastic)
  assert.equal(elastic.adapter, 'script')
  assert.equal(elastic.atsPlatform, 'official-company-careers')
  assert.match(elastic.companyCareerPage, /elastic\.co\/careers/i)
  assert.equal(elastic.companyDomain, 'elastic.co')
})

test('buildScrapers exposes a runnable Elastic script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const elastic = scrapers.find((scraper) => scraper.name === 'elastic')

  assert.ok(elastic)
  assert.equal(typeof elastic.run, 'function')
  assert.match(elastic.dryRunFile, /elastic[\\/]jobs\.json$/)
  assert.equal(elastic.provider.source, 'elastic')
  assert.equal(elastic.provider.atsPlatform, 'official-company-careers')
})
