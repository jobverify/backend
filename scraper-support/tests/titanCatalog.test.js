import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Titan as an exact-name zero-jobs script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'titan')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Titan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.titancompany.in/careers')
  assert.equal(provider.companyDomain, 'titancompany.in')
  assert.match(provider.modulePath, /titan[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Titan scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'titan')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'titan')
  assert.equal(scraper.provider.companyName, 'Titan')
  assert.match(scraper.dryRunFile, /titan[\\/]jobs\.json$/i)
})
