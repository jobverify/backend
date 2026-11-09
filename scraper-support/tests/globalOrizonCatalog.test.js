import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Global Orizon as a verified first-party hiring-partner role provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'globalorizon')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Global Orizon')
  assert.equal(provider.companyCareerPage, 'https://www.globalorizon.com/the-hiring-partner-com')
  assert.equal(provider.companyDomain, 'globalorizon.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedIndiaJobCount, 3)
  assert.match(provider.paginationStrategy, /first-party-role-page/i)
  assert.match(provider.extractionStrategy, /html-role-cards/i)
  assert.match(provider.verifiedSurfaceSummary, /DevOps Engineers/i)
  assert.match(provider.modulePath, /globalorizon[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Global Orizon scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'globalorizon')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'globalorizon')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /globalorizon[\\/]jobs\.json$/i)
})
