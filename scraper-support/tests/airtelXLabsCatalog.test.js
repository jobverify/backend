import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAirtelXLabsCatalog = async () => {
  try {
    return await import('../../scraper/airtelxlabs/catalog.js')
  } catch {
    assert.fail('Expected Airtel X Labs catalog module at ../../scraper/airtelxlabs/catalog.js')
  }
}

test('Airtel X Labs provider metadata captures the verified branded frameset and generic Airtel careers handoff without aliases', async () => {
  const { AIRTEL_X_LABS_CATALOG } = await loadAirtelXLabsCatalog()
  const provider = hydrateProviderCatalogEntry(AIRTEL_X_LABS_CATALOG)

  assert.equal(provider.source, 'airtelxlabs')
  assert.equal(provider.companyName, 'Airtel X Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.airtel.in/careers/airtelxlabs/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-branded-frameset-plus-generic-airtel-careers-handoff-plus-missing-branded-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-branded-homepage+verified-generic-airtel-careers-handoff-without-x-labs-jobs+verified-missing-branded-routes+verified-generic-x-labs-subroutes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'airtelxlabs.com')
  assert.equal(provider.officialBrandName, 'Airtel X Labs')
  assert.equal(provider.brandedHomepageUrl, 'https://www.airtelxlabs.com/')
  assert.equal(provider.parentCareersPage, 'https://careers.airtel.com/')
  assert.match(provider.modulePath, /airtelxlabs[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.airtelxlabs\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.airtel\.in\/careers\/airtelxlabs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.airtel\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Airtel X Labs'), false)
})

test('Airtel X Labs backlog row matches directly from provider metadata without alias churn', async () => {
  const { AIRTEL_X_LABS_CATALOG } = await loadAirtelXLabsCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Airtel X Labs\n',
    catalog: [hydrateProviderCatalogEntry(AIRTEL_X_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel X Labs', 'airtelxlabs', 'Airtel X Labs']],
  )
})

test('buildScrapers and company coverage resolve Airtel X Labs from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airtelxlabs')
  const scraper = buildScrapers().find((item) => item.name === 'airtelxlabs')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airtel X Labs')
  assert.equal(provider.companyCareerPage, 'https://www.airtel.in/careers/airtelxlabs/')
  assert.match(scraper.dryRunFile, /airtelxlabs[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airtel X Labs\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel X Labs', 'airtelxlabs', 'Airtel X Labs']],
  )
})
