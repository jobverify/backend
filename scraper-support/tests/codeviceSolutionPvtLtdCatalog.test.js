import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Codevice Solution Pvt Ltd is registered as a discovery-only first-party scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'codevicesolutionpvtltd')

  assert.ok(provider, 'Expected Codevice Solution Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Codevice Solution Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://codevicesolution.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-common-careers-route-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-shell+verified-client-bundle+verified-common-route-shells+no-public-listings-discovery-only-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'codevicesolution.in')
  assert.equal(provider.verifiedOn, '2026-09-14')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.modulePath, /codevicesolutionpvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Codevice Solution Pvt Ltd'), false)
})

test('Codevice Solution Pvt Ltd matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Codevice Solution Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Codevice Solution Pvt Ltd', 'codevicesolutionpvtltd', 'Codevice Solution Pvt Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'codevicesolutionpvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Codevice Solution Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'codevicesolutionpvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://codevicesolution.in/')
  assert.match(scraper.dryRunFile, /codevicesolutionpvtltd[\\/]jobs\.json$/i)
})
