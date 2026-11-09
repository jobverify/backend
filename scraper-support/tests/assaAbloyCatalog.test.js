import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes the ASSA ABLOY scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const assaAbloy = catalog.find((provider) => provider.source === 'assaabloy')

  assert.ok(assaAbloy)
  assert.equal(assaAbloy.adapter, 'script')
  assert.equal(assaAbloy.atsPlatform, 'assaabloy-job-openings-api')
  assert.match(assaAbloy.companyCareerPage, /assaabloy\.com\/career\/en\/open-positions/i)
  assert.equal(assaAbloy.companyDomain, 'assaabloy.com')
})

test('buildScrapers exposes a runnable ASSA ABLOY scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const assaAbloy = scrapers.find((scraper) => scraper.name === 'assaabloy')

  assert.ok(assaAbloy)
  assert.equal(typeof assaAbloy.run, 'function')
  assert.match(assaAbloy.dryRunFile, /assaabloy[\\/]jobs\.json$/)
  assert.equal(assaAbloy.provider.source, 'assaabloy')
  assert.equal(assaAbloy.provider.atsPlatform, 'assaabloy-job-openings-api')
})
