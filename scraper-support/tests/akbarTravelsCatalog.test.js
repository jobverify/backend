import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAkbarTravelsCatalog = async () => {
  try {
    return await import('../../scraper/akbartravels/catalog.js')
  } catch {
    assert.fail('Expected Akbar Travels catalog module at ../../scraper/akbartravels/catalog.js')
  }
}

test('Akbar Travels provider metadata captures the verified first-party careers page and no-public-jobs surface without aliases', async () => {
  const { AKBAR_TRAVELS_CATALOG } = await loadAkbarTravelsCatalog()
  const provider = hydrateProviderCatalogEntry(AKBAR_TRAVELS_CATALOG)

  assert.equal(provider.source, 'akbartravels')
  assert.equal(provider.companyName, 'Akbar Travels')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.akbartravels.com/careers')
  assert.equal(provider.localizedCareersPage, 'https://www.akbartravels.com/in/careers')
  assert.equal(provider.homepageUrl, 'https://www.akbartravels.com/in')
  assert.equal(provider.rootUrl, 'https://www.akbartravels.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-root-redirect-plus-first-party-careers-copy-plus-missing-common-job-routes',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-root-redirect+verified-india-homepage+verified-careers-copy-email-resume-handoff-without-public-listings+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'akbartravels.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /akbartravels[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.akbartravels\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.akbartravels\.com\/in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@akbartravels\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Akbar Travels'), false)
})

test('Akbar Travels backlog row matches directly from provider metadata without alias churn', async () => {
  const { AKBAR_TRAVELS_CATALOG } = await loadAkbarTravelsCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Akbar Travels\n',
    catalog: [hydrateProviderCatalogEntry(AKBAR_TRAVELS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akbar Travels', 'akbartravels', 'Akbar Travels']],
  )
})

test('buildScrapers and company coverage resolve Akbar Travels from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akbartravels')
  const scraper = buildScrapers().find((item) => item.name === 'akbartravels')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akbar Travels')
  assert.equal(provider.companyCareerPage, 'https://www.akbartravels.com/careers')
  assert.match(scraper.dryRunFile, /akbartravels[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akbar Travels\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akbar Travels', 'akbartravels', 'Akbar Travels']],
  )
})
