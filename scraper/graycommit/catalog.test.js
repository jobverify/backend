import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Graycommit is registered against its official careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'graycommit')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Graycommit')
  assert.equal(provider.companyCareerPage, 'https://www.graycommit.com/careers')
  assert.equal(provider.atsPlatform, 'official-first-party-spa-no-public-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-expo-shell+bundle-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-expo-shell+verified-no-public-careers-bundle-return-empty',
  )
  assert.equal(provider.companyDomain, 'graycommit.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /_expo\/static\/js\/web\/entry-/i)
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /graycommit[\\/]script\.js$/i)
})

test('Graycommit is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'graycommit')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /graycommit[\\/]jobs\.json$/i)
})
