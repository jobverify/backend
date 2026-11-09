import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadAnantaAspenCentreCatalog = async () => {
  try {
    return await import('../../scraper/anantaaspencentre/catalog.js')
  } catch {
    assert.fail('Expected Ananta Aspen Centre catalog module at ../../scraper/anantaaspencentre/catalog.js')
  }
}

test('Ananta Aspen Centre provider metadata captures the verified first-party nonlisting careers surface', async () => {
  const { ANANTA_ASPEN_CENTRE_CATALOG } = await loadAnantaAspenCentreCatalog()
  const provider = hydrateProviderCatalogEntry(ANANTA_ASPEN_CENTRE_CATALOG)

  assert.equal(provider.source, 'anantaaspencentre')
  assert.equal(provider.companyName, 'Ananta Aspen Centre')
  assert.equal(provider.officialBrandName, 'Ananta Centre')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://anantacentre.in/careers/')
  assert.equal(provider.homepageUrl, 'https://anantacentre.in/')
  assert.equal(provider.careersPageUrl, 'https://anantacentre.in/careers/')
  assert.equal(provider.legacyCareerUrl, 'https://anantacentre.in/career')
  assert.deepEqual(provider.noPublicJobRouteUrls, [
    'https://anantacentre.in/jobs',
    'https://anantacentre.in/join-us',
    'https://anantacentre.in/work-with-us',
    'https://anantacentre.in/openings',
  ])
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-careers-form-shell-plus-common-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-apply-popup-form+verified-career-redirect+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'anantacentre.in')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /anantaaspencentre[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anantacentre\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anantacentre\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anantacentre\.in\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anantacentre\.in\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /generic Apply Now popup form/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Ananta Aspen Centre backlog row matches directly from provider metadata without aliases', async () => {
  const { ANANTA_ASPEN_CENTRE_CATALOG } = await loadAnantaAspenCentreCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Ananta Aspen Centre\n',
    catalog: [hydrateProviderCatalogEntry(ANANTA_ASPEN_CENTRE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ananta Aspen Centre', 'anantaaspencentre', 'Ananta Aspen Centre']],
  )
})

test('buildScrapers and company coverage resolve Ananta Aspen Centre from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anantaaspencentre')
  const scraper = buildScrapers().find((item) => item.name === 'anantaaspencentre')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Ananta Aspen Centre')
  assert.equal(provider.companyCareerPage, 'https://anantacentre.in/careers/')
  assert.match(scraper.dryRunFile, /anantaaspencentre[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Ananta Aspen Centre\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ananta Aspen Centre', 'anantaaspencentre', 'Ananta Aspen Centre']],
  )
})
