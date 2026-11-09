import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/circleci/catalog.js')
  } catch {
    assert.fail('Expected CircleCI catalog module at ../../scraper/circleci/catalog.js')
  }
}

test('getScraperCatalog includes CircleCI as a verified first-party script provider', async () => {
  const { CIRCLECI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'circleci')

  assert.equal(defaultCatalog, CIRCLECI_CATALOG)
  assert.ok(provider, 'Expected CircleCI provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CircleCI')
  assert.equal(provider.officialBrandName, 'CircleCI')
  assert.equal(provider.companyCareerPage, 'https://circleci.com/careers/jobs/')
  assert.equal(provider.companyDomain, 'circleci.com')
  assert.equal(provider.atsPlatform, 'official-circleci-careers-greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'full-native-board-and-corporate-inventory-with-closing-comparison-before-caps')
  assert.equal(
    provider.extractionStrategy,
    'active-corporate-role-greenhouse-embed+full-native-job-criteria+own-country-proof',
  )
  assert.equal(provider.parser, 'current-company-and-native-ats')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.modulePath, /circleci[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /circleci[\\/]jobs\.json$/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.match(provider.verifiedSurfaceSummary, /count disagreements and unresolved native worksite countries/i)
})

test('buildScrapers exposes a runnable CircleCI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'circleci')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /circleci[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'circleci')
  assert.equal(scraper.provider.companyCareerPage, 'https://circleci.com/careers/jobs/')
})
