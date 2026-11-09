import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes CBRE on the public DirectEmployers India jobs host', () => {
  const catalog = getScraperCatalog()
  const cbre = catalog.find((provider) => provider.source === 'cbre')

  assert.ok(cbre)
  assert.equal(cbre.adapter, 'script')
  assert.equal(cbre.atsPlatform, 'jobsyn-solr')
  assert.equal(cbre.companyCareerPage, 'https://cbre.dejobs.org/locations/ind/jobs/')
  assert.equal(cbre.companyDomain, 'cbre.dejobs.org')
})

test('buildScrapers exposes a runnable CBRE scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const cbre = scrapers.find((scraper) => scraper.name === 'cbre')

  assert.ok(cbre)
  assert.equal(typeof cbre.run, 'function')
  assert.match(cbre.dryRunFile, /cbre[\\/]jobs\.json$/)
  assert.equal(cbre.provider.source, 'cbre')
  assert.equal(cbre.provider.adapter, 'script')
})
