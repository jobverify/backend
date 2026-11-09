import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/edrcontinuousinformation/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/edrcontinuousinformation/catalog.js')
  } catch {
    assert.fail('Expected EDR Continuous Information catalog module at ../../scraper/edrcontinuousinformation/catalog.js')
  }
}

test('EDR Continuous Information local catalog captures the verified no-careers-surface metadata', async () => {
  const { EDR_CONTINUOUS_INFORMATION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EDR_CONTINUOUS_INFORMATION_CATALOG)

  assert.equal(defaultCatalog, EDR_CONTINUOUS_INFORMATION_CATALOG)
  assert.equal(provider.source, 'edrcontinuousinformation')
  assert.equal(provider.companyName, 'EDR Continuous Information')
  assert.equal(provider.officialBrandName, 'EDR')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.edrinfo.net/')
  assert.equal(provider.companyCareerPage, 'https://www.edrinfo.net/')
  assert.equal(provider.companyDomain, 'edrinfo.net')
  assert.equal(provider.atsPlatform, 'official-homepage-without-careers-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-without-public-careers-or-jobs-surface-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /edrcontinuousinformation[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Global Resources At Your Command/i)
  assert.match(provider.verifiedSurfaceSummary, /\/careers, \/jobs, and \/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 404/i)
})

test('EDR Continuous Information exact backlog row matches directly from local provider metadata', async () => {
  const { EDR_CONTINUOUS_INFORMATION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'EDR Continuous Information\n',
    catalog: [hydrateProviderCatalogEntry(EDR_CONTINUOUS_INFORMATION_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['EDR Continuous Information', 'edrcontinuousinformation', 'EDR Continuous Information']],
  )
})

test('EDR Continuous Information hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { EDR_CONTINUOUS_INFORMATION_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EDR_CONTINUOUS_INFORMATION_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'EDR Continuous Information')
  assert.equal(provider.companyDomain, 'edrinfo.net')
  assert.equal(provider.atsPlatform, 'official-homepage-without-careers-surface')
  assert.match(provider.modulePath, /edrcontinuousinformation[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /edrcontinuousinformation[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
