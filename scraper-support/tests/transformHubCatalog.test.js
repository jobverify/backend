import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/transformhub/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/transformhub/catalog.js')
  } catch {
    assert.fail('Expected TransformHub catalog module at ../../scraper/transformhub/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/transformhub/script.js')
  } catch {
    assert.fail('Expected TransformHub scraper module at ../../scraper/transformhub/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('TransformHub local catalog captures the verified first-party inline openings page', async () => {
  const { TRANSFORM_HUB_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const transformHub = await loadScriptModule()
  const provider = buildCatalogReadyProvider(TRANSFORM_HUB_CATALOG)

  assert.equal(defaultCatalog, TRANSFORM_HUB_CATALOG)
  assert.equal(provider.source, 'transformhub')
  assert.equal(provider.companyName, 'TransformHub')
  assert.equal(provider.officialBrandName, 'TransformHub')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.transformhub.com/')
  assert.equal(provider.companyCareerPage, 'https://www.transformhub.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-text-sections')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-sections+shared-careers-page-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'transformhub.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.transformhub\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /DEVSECOPS - SENIOR ENGINEER/i)
  assert.match(provider.verifiedSurfaceSummary, /ZOHO DEVELOPER/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /transformhub[\\/]jobs\.json$/i)

  assert.equal(transformHub.PROVIDER_METADATA.source, provider.source)
  assert.equal(transformHub.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(transformHub.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('TransformHub exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { TRANSFORM_HUB_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TransformHub\n',
    catalog: [buildCatalogReadyProvider(TRANSFORM_HUB_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TransformHub', 'transformhub', 'TransformHub']],
  )
})
