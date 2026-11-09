import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const freeChargeModulePath = path.resolve(currentDir, '../../scraper/freecharge/script.js')

const loadFreeChargeCatalog = async () => {
  try {
    return await import('../../scraper/freecharge/catalog.js')
  } catch {
    assert.fail('Expected FreeCharge catalog module at ../../scraper/freecharge/catalog.js')
  }
}

test('FreeCharge catalog captures the verified first-party careers handoff surface', async () => {
  const { FREECHARGE_CATALOG } = await loadFreeChargeCatalog()
  const provider = hydrateProviderCatalogEntry(FREECHARGE_CATALOG)

  assert.equal(provider.source, 'freecharge')
  assert.equal(provider.companyName, 'FreeCharge')
  assert.equal(provider.officialBrandName, 'Freecharge')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.freecharge.in/')
  assert.equal(provider.companyCareerPage, 'https://careers.freecharge.in/')
  assert.equal(provider.portalOrigin, 'https://freecharge.ripplehire.com')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  )
  assert.equal(
    provider.jobBoardUrl,
    'https://freecharge.ripplehire.com/candidate/?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://freecharge.ripplehire.com/candidate/candidatejobsearch',
  )
  assert.equal(provider.companyDomain, 'freecharge.in')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-param-on-public-ripplehire-board')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+ripplehire-list-detail-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, freeChargeModulePath)
  assert.match(provider.dryRunFile, /freecharge[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.freecharge\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.freecharge\.in\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/freecharge\.ripplehire\.com\/candidate\/\?token=IoV5vvUSMKLwmaa1Suou&source=CAREERSITE#list/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/freecharge\.ripplehire\.com\/candidate\/candidatejobsearch/i,
  )
})

test('FreeCharge backlog row matches directly from provider metadata without a shared alias entry', async () => {
  const { FREECHARGE_CATALOG } = await loadFreeChargeCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'FreeCharge\n',
    catalog: [hydrateProviderCatalogEntry(FREECHARGE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FreeCharge', 'freecharge', 'FreeCharge']],
  )
})
