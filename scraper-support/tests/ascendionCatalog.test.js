import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Ascendion scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const ascendion = catalog.find((provider) => provider.source === 'ascendion')

  assert.ok(ascendion)
  assert.equal(ascendion.adapter, 'script')
  assert.equal(ascendion.atsPlatform, 'eightfold-pcsx')
  assert.match(ascendion.companyCareerPage, /jobs\.ascendion\.com\/careers/i)
  assert.equal(ascendion.companyDomain, 'jobs.ascendion.com')
})

test('buildScrapers exposes a runnable Ascendion scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const ascendion = scrapers.find((scraper) => scraper.name === 'ascendion')

  assert.ok(ascendion)
  assert.equal(typeof ascendion.run, 'function')
  assert.match(ascendion.dryRunFile, /ascendion[\\/]jobs\.json$/)
  assert.equal(ascendion.provider.source, 'ascendion')
  assert.equal(ascendion.provider.atsPlatform, 'eightfold-pcsx')
})
