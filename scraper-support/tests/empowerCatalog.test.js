import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Empower as a talentbrew-radancy scraper with official metadata', () => {
  const catalog = getScraperCatalog()
  const empower = catalog.find((provider) => provider.source === 'empower')

  assert.ok(empower)
  assert.equal(empower.adapter, 'script')
  assert.equal(empower.atsPlatform, 'talentbrew-radancy')
  assert.match(empower.companyCareerPage, /jobs\.empower\.com\/india-jobs/i)
  assert.equal(empower.companyDomain, 'jobs.empower.com')
})

test('buildScrapers exposes a runnable Empower scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const empower = scrapers.find((scraper) => scraper.name === 'empower')

  assert.ok(empower)
  assert.equal(typeof empower.run, 'function')
  assert.match(empower.dryRunFile, /empower[\\/]jobs\.json$/)
  assert.equal(empower.provider.source, 'empower')
  assert.equal(empower.provider.atsPlatform, 'talentbrew-radancy')
})
