import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/scaleflex/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/scaleflex/catalog.js')
  } catch {
    assert.fail('Expected Scaleflex catalog module at ../../scraper/scaleflex/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/scaleflex/script.js')
  } catch {
    assert.fail('Expected Scaleflex scraper module at ../../scraper/scaleflex/script.js')
  }
}

test('Scaleflex local catalog captures the verified first-party no-public-jobs surface', async () => {
  const { SCALEFLEX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scaleflex = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SCALEFLEX_CATALOG)

  assert.equal(defaultCatalog, SCALEFLEX_CATALOG)
  assert.equal(provider.source, 'scaleflex')
  assert.equal(provider.companyName, 'Scaleflex')
  assert.equal(provider.officialBrandName, 'Scaleflex')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.scaleflex.com/')
  assert.equal(provider.companyDomain, 'scaleflex.com')
  assert.equal(provider.officialHomepageUrl, 'https://www.scaleflex.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://portals.scaleflex.com/s/xJfYX5yl/en/home')
  assert.deepEqual(provider.checkedCareersRouteUrls, [
    'https://www.scaleflex.com/careers',
    'https://www.scaleflex.com/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-homepage-careers-link-loading-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-linked-portal-plus-common-careers-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-loading-careers-portal+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /scaleflex[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.scaleflex\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/portals\.scaleflex\.com\/s\/xJfYX5yl\/en\/home/i)
  assert.match(provider.verifiedSurfaceSummary, /We are Hiring/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Scaleflex'), false)

  assert.equal(scaleflex.PROVIDER_METADATA.source, SCALEFLEX_CATALOG.source)
  assert.equal(scaleflex.PROVIDER_METADATA.companyName, SCALEFLEX_CATALOG.companyName)
  assert.equal(
    scaleflex.PROVIDER_METADATA.officialCareersHandoffUrl,
    SCALEFLEX_CATALOG.officialCareersHandoffUrl,
  )
})

test('Scaleflex exact backlog row matches directly from the local sentinel metadata without aliases', async () => {
  const { SCALEFLEX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Scaleflex\n',
    catalog: [hydrateProviderCatalogEntry(SCALEFLEX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Scaleflex', 'scaleflex', 'Scaleflex']],
  )
})
