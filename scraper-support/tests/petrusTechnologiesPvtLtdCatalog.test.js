import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Petrus Technologies Pvt Ltd is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'petrustechnologiespvtltd')

  assert.ok(provider, 'Expected Petrus Technologies Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Petrus Technologies Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://www.petrustechnologies.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-route-bundle-plus-about-contact-component-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-route-bundle-without-careers+verified-about-and-contact-components+verified-common-careers-shell-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'petrustechnologies.com')
  assert.match(provider.modulePath, /petrustechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Petrus Technologies Pvt Ltd'), false)
})

test('Petrus Technologies Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Petrus Technologies Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Petrus Technologies Pvt Ltd', 'petrustechnologiespvtltd', 'Petrus Technologies Pvt Ltd']],
  )
})

test('Petrus Technologies Pvt Ltd is runnable through the shared scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'petrustechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Petrus Technologies Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'petrustechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.petrustechnologies.com/')
  assert.match(scraper.dryRunFile, /petrustechnologiespvtltd[\\/]jobs\.json$/i)
})
