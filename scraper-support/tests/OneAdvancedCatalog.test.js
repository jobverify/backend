import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/oneadvanced/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oneadvanced/catalog.js')
  } catch {
    assert.fail('Expected OneAdvanced catalog module at ../../scraper/oneadvanced/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('OneAdvanced local catalog captures the verified first-party careers shell and public iCIMS search surface', async () => {
  const { ONEADVANCED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(ONEADVANCED_CATALOG)

  assert.equal(defaultCatalog, ONEADVANCED_CATALOG)
  assert.equal(provider.source, 'oneadvanced')
  assert.equal(provider.companyName, 'OneAdvanced')
  assert.equal(provider.officialBrandName, 'OneAdvanced')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.oneadvanced.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.oneadvanced.com/')
  assert.equal(provider.searchPageUrl, 'https://careers-oneadvanced.icims.com/jobs/search?ss=1&in_iframe=1')
  assert.equal(provider.atsPlatform, 'icims')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-shell-plus-icims-search-pages')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell+verified-icims-search-page+india-job-detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.oneadvanced.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers-oneadvanced\.icims\.com\/jobs\/search\?ss=1&in_iframe=1/i)
})

test('OneAdvanced exact backlog row resolves from the local provider contract', async () => {
  const { ONEADVANCED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OneAdvanced\n',
    catalog: [buildProvider(ONEADVANCED_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OneAdvanced', 'oneadvanced', 'OneAdvanced']],
  )
})
