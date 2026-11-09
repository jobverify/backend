import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Burns & McDonnell with its public jobs search metadata', () => {
  const catalog = getScraperCatalog()
  const burns = catalog.find((provider) => provider.source === 'burnsmcdonnell')

  assert.ok(burns)
  assert.equal(burns.adapter, 'script')
  assert.equal(burns.atsPlatform, 'jobsyn-solr')
  assert.equal(burns.companyCareerPage, 'https://burnsmcd.jobs/locations/ind/jobs/')
  assert.equal(burns.companyDomain, 'burnsmcd.jobs')
})

test('buildScrapers exposes a runnable Burns & McDonnell scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const burns = scrapers.find((scraper) => scraper.name === 'burnsmcdonnell')

  assert.ok(burns)
  assert.equal(typeof burns.run, 'function')
  assert.match(burns.dryRunFile, /burnsmcdonnell[\\/]jobs\.json$/)
  assert.equal(burns.provider.source, 'burnsmcdonnell')
  assert.equal(burns.provider.adapter, 'script')
})
