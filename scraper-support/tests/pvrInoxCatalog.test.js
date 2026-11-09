import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/pvrinox/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pvrinox/catalog.js')
  } catch {
    assert.fail('Expected PVR INOX catalog module at ../../scraper/pvrinox/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pvrinox/script.js')
  } catch {
    assert.fail('Expected PVR INOX scraper module at ../../scraper/pvrinox/script.js')
  }
}

test('PVR INOX local catalog captures the verified generic public careers shell metadata', async () => {
  const { PVR_INOX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pvrInox = await loadScraperModule()

  assert.equal(defaultCatalog, PVR_INOX_CATALOG)
  assert.equal(PVR_INOX_CATALOG.source, 'pvrinox')
  assert.equal(PVR_INOX_CATALOG.companyName, 'PVR INOX')
  assert.equal(PVR_INOX_CATALOG.officialBrandName, 'PVR INOX')
  assert.equal(PVR_INOX_CATALOG.adapter, 'script')
  assert.equal(PVR_INOX_CATALOG.homepageUrl, 'https://www.pvrcinemas.com/')
  assert.equal(PVR_INOX_CATALOG.companyCareerPage, 'https://www.pvrcinemas.com/careers-us')
  assert.deepEqual(PVR_INOX_CATALOG.careerRouteUrls, [
    'https://www.pvrcinemas.com/careers-us',
    'https://www.pvrcinemas.com/career',
    'https://www.pvrcinemas.com/careers',
  ])
  assert.equal(PVR_INOX_CATALOG.companyDomain, 'pvrcinemas.com')
  assert.equal(PVR_INOX_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(PVR_INOX_CATALOG.countryFilter, 'India')
  assert.equal(
    PVR_INOX_CATALOG.paginationStrategy,
    'verified-first-party-careers-routes-plus-generic-spa-shell-validation',
  )
  assert.equal(
    PVR_INOX_CATALOG.extractionStrategy,
    'verified-careers-us-route+verified-parallel-career-routes-return-generic-movie-booking-spa-shell+no-public-jobs-markers',
  )
  assert.equal(PVR_INOX_CATALOG.parser, 'custom-script')
  assert.equal(PVR_INOX_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(PVR_INOX_CATALOG.dryRunFile, 'pvrinox/jobs.json')
  assert.equal(PVR_INOX_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(PVR_INOX_CATALOG.modulePath, modulePath)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.pvrcinemas\.com\/careers-us/i)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.pvrcinemas\.com\/career/i)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.pvrcinemas\.com\/careers/i)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /generic movie-booking spa shell/i)
  assert.match(PVR_INOX_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(pvrInox.PROVIDER_METADATA.source, PVR_INOX_CATALOG.source)
  assert.equal(pvrInox.PROVIDER_METADATA.companyName, PVR_INOX_CATALOG.companyName)
})

test('PVR INOX exact backlog row matches directly from the local provider metadata', async () => {
  const { PVR_INOX_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'PVR INOX\n',
    catalog: [PVR_INOX_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PVR INOX', 'pvrinox', 'PVR INOX']],
  )
})
