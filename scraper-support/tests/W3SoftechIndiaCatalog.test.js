import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/w3softechindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/w3softechindia/catalog.js')
  } catch {
    assert.fail('Expected W3Softech India catalog module at ../../scraper/w3softechindia/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('W3Softech India local catalog captures the verified first-party careers table surface', async () => {
  const { W3SOFTECH_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(W3SOFTECH_INDIA_CATALOG)

  assert.equal(defaultCatalog, W3SOFTECH_INDIA_CATALOG)
  assert.equal(provider.source, 'w3softechindia')
  assert.equal(provider.companyName, 'W3Softech India')
  assert.equal(provider.officialBrandName, 'W3Softech India Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://w3softech.com/')
  assert.equal(provider.companyCareerPage, 'https://w3softech.com/career')
  assert.equal(provider.atsPlatform, 'official-company-site-html-jobs-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'html-jobs-table')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'w3softech.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/w3softech\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /Python Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /MuleSoft Developer/i)
})

test('W3Softech India exact backlog row resolves from the local provider contract', async () => {
  const { W3SOFTECH_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'W3Softech India\n',
    catalog: [buildCatalogReadyProvider(W3SOFTECH_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['W3Softech India', 'w3softechindia', 'W3Softech India']],
  )
})
