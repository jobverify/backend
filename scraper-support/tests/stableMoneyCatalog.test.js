import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadStableMoneyCatalog = async () => {
  try {
    return await import('../../scraper/stablemoney/catalog.js')
  } catch {
    assert.fail('Expected Stable Money catalog module at ../../scraper/stablemoney/catalog.js')
  }
}

test('Stable Money catalog metadata captures the verified reachable first-party no-public-jobs surface', async () => {
  const { STABLE_MONEY_CATALOG } = await loadStableMoneyCatalog()
  const provider = hydrateProviderCatalogEntry(STABLE_MONEY_CATALOG)

  assert.equal(provider.source, 'stablemoney')
  assert.equal(provider.companyName, 'Stable Money')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://stablemoney.in/')
  assert.equal(provider.homepageUrl, 'https://stablemoney.in/')
  assert.equal(provider.aboutUsUrl, 'https://stablemoney.in/about-us')
  assert.equal(provider.contactUsUrl, 'https://stablemoney.in/contact-us')
  assert.equal(provider.officialBrandName, 'Stable Money')
  assert.equal(provider.legalEntityName, 'Stable Finserv Private Limited')
  assert.equal(provider.platformEntityName, 'Stable-Alpha Technologies Private Limited')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'reachable-first-party-pages-plus-adjacent-no-jobs-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-about-contact-pages+adjacent-first-party-careers-routes-no-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'stablemoney.in')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.deepEqual(provider.officialFirstPartyUrls, [
    'https://stablemoney.in/',
    'https://stablemoney.in/about-us',
    'https://stablemoney.in/contact-us',
  ])
  assert.deepEqual(provider.noPublicJobsRouteUrls, [
    'https://stablemoney.in/careers',
    'https://stablemoney.in/career',
    'https://stablemoney.in/jobs',
    'https://stablemoney.in/join-us',
    'https://stablemoney.in/work-with-us',
    'https://stablemoney.in/openings',
  ])
  assert.match(provider.modulePath, /stablemoney[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stablemoney[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/stablemoney\.in\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/stablemoney\.in\/contact-us/i)
  assert.match(provider.verifiedSurfaceSummary, /help@stablemoney\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /returned 404/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Stable Money matches exact-name backlog coverage from the local catalog contract alone', async () => {
  const { STABLE_MONEY_CATALOG } = await loadStableMoneyCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Stable Money\n',
    catalog: [hydrateProviderCatalogEntry(STABLE_MONEY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Stable Money', 'stablemoney', 'Stable Money']],
  )
})
