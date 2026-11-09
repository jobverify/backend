import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bgdtechpvtltd/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bgdtechpvtltd/catalog.js')
  } catch {
    assert.fail('Expected BGD Tech PVT LTD catalog module at ../../scraper/bgdtechpvtltd/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('BGD Tech PVT LTD local catalog captures the verified first-party careers intake page without public listings', async () => {
  const { BGD_TECH_PVT_LTD_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(BGD_TECH_PVT_LTD_CATALOG)

  assert.equal(defaultCatalog, BGD_TECH_PVT_LTD_CATALOG)
  assert.equal(provider.source, 'bgdtechpvtltd')
  assert.equal(provider.companyName, 'BGD Tech PVT LTD')
  assert.equal(provider.officialBrandName, 'BGD - Tech private limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://bgd-limited.com/')
  assert.equal(provider.companyCareerPage, 'https://bgd-limited.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-resume-intake-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-intake-page-without-public-listings-or-403-forbidden-surface')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bgd-limited.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /hello@bgd-limited\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /403 Forbidden|404 Page Not Found/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public listings|no public jobs/i)
})

test('BGD Tech PVT LTD exact backlog row resolves from the local provider contract', async () => {
  const { BGD_TECH_PVT_LTD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'BGD Tech PVT LTD\n',
    catalog: [buildCatalogReadyProvider(BGD_TECH_PVT_LTD_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['BGD Tech PVT LTD', 'bgdtechpvtltd', 'BGD Tech PVT LTD']],
  )
})
