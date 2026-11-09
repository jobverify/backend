import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/realtimedataservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/realtimedataservices/catalog.js')
  } catch {
    assert.fail('Expected Real Time Data Services catalog module at ../../scraper/realtimedataservices/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Real Time Data Services local catalog captures the verified first-party careers page and inline position payloads', async () => {
  const { REAL_TIME_DATA_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(REAL_TIME_DATA_SERVICES_CATALOG)

  assert.equal(defaultCatalog, REAL_TIME_DATA_SERVICES_CATALOG)
  assert.equal(provider.source, 'realtimedataservices')
  assert.equal(provider.companyName, 'Real Time Data Services')
  assert.equal(provider.officialBrandName, 'Real Time Data Services')
  assert.equal(provider.companyCareerPage, 'https://myrealdata.in/careers/')
  assert.equal(provider.applyFormUrl, 'https://myrealdata.in/careers/apply-online/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+inline-json-position-payloads')
  assert.equal(provider.companyDomain, 'myrealdata.in')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Software Development Engineer/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Real Time Data Services exact backlog row resolves from the local provider contract', async () => {
  const { REAL_TIME_DATA_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Real Time Data Services\n',
    catalog: [buildProvider(REAL_TIME_DATA_SERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
