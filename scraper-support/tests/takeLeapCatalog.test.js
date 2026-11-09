import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadTakeLeapCatalog = async () => {
  try {
    return await import('../../scraper/takeleap/catalog.js')
  } catch {
    assert.fail('Expected TakeLeap catalog module at ../../scraper/takeleap/catalog.js')
  }
}

test('TakeLeap catalog metadata captures the verified first-party brochure surface with no trustworthy public jobs board', async () => {
  const { TAKE_LEAP_CATALOG } = await loadTakeLeapCatalog()
  const provider = hydrateProviderCatalogEntry(TAKE_LEAP_CATALOG)

  assert.equal(provider.source, 'takeleap')
  assert.equal(provider.companyName, 'TakeLeap')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://takeleap.com/')
  assert.equal(provider.homepageUrl, 'https://takeleap.com/')
  assert.equal(provider.aboutUsUrl, 'https://takeleap.com/about-us')
  assert.equal(provider.contactUsUrl, 'https://takeleap.com/contact/')
  assert.equal(provider.officialBrandName, 'TAKELEAP')
  assert.equal(provider.legalEntityName, 'TAKELEAP DMCC')
  assert.equal(provider.businessEmail, 'digital@takeleap.com')
  assert.equal(provider.indiaContactEmail, 'gm.india@takeleap.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-first-party-route-timeout-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-plus-about-and-contact-pages+exact-name-first-party-routes-timeout-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'takeleap.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.modulePath, /takeleap[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /takeleap[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/takeleap\.com\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/takeleap\.com\/contact\//i)
  assert.match(provider.verifiedSurfaceSummary, /digital@takeleap\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('TakeLeap matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { TAKE_LEAP_CATALOG } = await loadTakeLeapCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'TakeLeap\n',
    catalog: [hydrateProviderCatalogEntry(TAKE_LEAP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TakeLeap', 'takeleap', 'TakeLeap']],
  )
})
