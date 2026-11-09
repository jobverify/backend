import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the Aujas scraper with NuSummit current openings metadata', () => {
  const catalog = getScraperCatalog()
  const aujas = catalog.find((provider) => provider.source === 'aujas')

  assert.ok(aujas)
  assert.equal(aujas.adapter, 'script')
  assert.equal(aujas.atsPlatform, 'wordpress-job-openings')
  assert.match(aujas.companyCareerPage, /nusummit\.com\/current-openings/i)
  assert.equal(aujas.companyDomain, 'nusummit.com')
})

test('buildScrapers exposes a runnable Aujas scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const aujas = scrapers.find((scraper) => scraper.name === 'aujas')

  assert.ok(aujas)
  assert.equal(typeof aujas.run, 'function')
  assert.match(aujas.dryRunFile, /aujas[\\/]jobs\.json$/)
  assert.equal(aujas.provider.source, 'aujas')
  assert.equal(aujas.provider.adapter, 'script')
})
