import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('YelloSKYE is registered as a first-party discovery-only provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yelloskye')

  assert.ok(provider, 'Expected YelloSKYE provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'YelloSKYE')
  assert.equal(provider.companyCareerPage, 'https://www.yelloskye.ai/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-domain-redirect-plus-current-client-bundle')
  assert.equal(
    provider.extractionStrategy,
    'verified-canonical-company-app+current-client-route-inspection+no-public-listings-discovery-only-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'yelloskye.ai')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.verifiedSurfaceSummary, /discovery-only evidence, not an authoritative empty-opening statement/i)
  assert.match(provider.modulePath, /yelloskye[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'YelloSKYE'), false)
})

test('YelloSKYE resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'YelloSKYE,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['YelloSKYE', 'yelloskye', 'YelloSKYE']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'yelloskye')

  assert.ok(scraper, 'Expected buildScrapers() to return the YelloSKYE sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yelloskye')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.yelloskye.ai/')
  assert.match(scraper.dryRunFile, /yelloskye[\\/]jobs\.json$/i)
})
