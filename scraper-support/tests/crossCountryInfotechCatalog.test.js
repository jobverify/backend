import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/crosscountryinfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/crosscountryinfotech/catalog.js')
  } catch {
    assert.fail('Expected Cross Country Infotech catalog module at ../../scraper/crosscountryinfotech/catalog.js')
  }
}

test('Cross Country Infotech local catalog captures the verified first-party careers page contract', async () => {
  const { CROSS_COUNTRY_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CROSS_COUNTRY_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, CROSS_COUNTRY_INFOTECH_CATALOG)
  assert.equal(provider.source, 'crosscountryinfotech')
  assert.equal(provider.companyName, 'Cross Country Infotech')
  assert.equal(provider.companyCareerPage, 'https://www.crosscountry.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-first-party-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+regex-job-card-extraction+deduped-openings',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Team Lead - BPO/i)
  assert.match(provider.verifiedSurfaceSummary, /crosscountry\.in\/careers/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /crosscountryinfotech[\\/]jobs\.json$/i)
})

test('Cross Country Infotech exact backlog row resolves from the local provider metadata', async () => {
  const { CROSS_COUNTRY_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cross Country Infotech\n',
    catalog: [hydrateProviderCatalogEntry(CROSS_COUNTRY_INFOTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
