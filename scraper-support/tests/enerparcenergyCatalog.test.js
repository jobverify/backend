import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog binds Enerparc Energy to its scoped own-native entry without changing the corporate identity', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'enerparcenergy')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zoho-recruit')
  assert.equal(provider.companyCareerPage, 'https://enerparc.in/apply-now/')
  assert.equal(provider.companyDomain, 'enerparc.in')
  assert.match(provider.modulePath, /enerparcenergy[\\/]native\.js$/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.sourceActivationComplete, false)
  assert.equal(provider.sourceRenderedCriteriaComplete, false)
  assert.equal(provider.sourceApplicationQualificationComplete, false)
})

test('buildScrapers exposes a runnable Enerparc Energy scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const provider = scrapers.find((scraper) => scraper.name === 'enerparcenergy')

  assert.ok(provider)
  assert.equal(typeof provider.run, 'function')
  assert.equal(provider.provider.adapter, 'script')
  assert.equal(provider.provider.atsPlatform, 'zoho-recruit')
  assert.match(provider.provider.modulePath, /enerparcenergy[\\/]native\.js$/i)
  assert.match(provider.dryRunFile, /enerparcenergy[\\/]jobs\.json$/)
})
