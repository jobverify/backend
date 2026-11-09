import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/laminaaraviationinfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/laminaaraviationinfotech/catalog.js')
  } catch {
    assert.fail('Expected Laminaar Aviation Infotech catalog module at ../../scraper/laminaaraviationinfotech/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Laminaar Aviation Infotech local catalog captures the verified no-public-careers SPA shell contract', async () => {
  const { LAMINAAR_AVIATION_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(LAMINAAR_AVIATION_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, LAMINAAR_AVIATION_INFOTECH_CATALOG)
  assert.equal(provider.source, 'laminaaraviationinfotech')
  assert.equal(provider.companyName, 'Laminaar Aviation Infotech')
  assert.equal(provider.officialBrandName, 'Laminaar Aviation Infotech (India) Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.laminaar.in/')
  assert.equal(provider.companyCareerPage, 'https://www.laminaar.in/careers')
  assert.equal(provider.atsPlatform, 'no-public-careers-route-on-first-party-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-spa-shell+careers-route-homepage-fallback+no-public-jobs-signal',
  )
  assert.equal(provider.companyDomain, 'laminaar.in')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
})

test('Laminaar Aviation Infotech exact backlog row resolves from the local catalog without aliases', async () => {
  const { LAMINAAR_AVIATION_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Laminaar Aviation Infotech\n',
    catalog: [buildProvider(LAMINAAR_AVIATION_INFOTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
