import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/excellonsoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/excellonsoftware/catalog.js')
  } catch {
    assert.fail('Expected Excellon Software catalog module at ../../scraper/excellonsoftware/catalog.js')
  }
}

test('Excellon Software local catalog captures the verified no-live-openings careers contract', async () => {
  const { EXCELLON_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EXCELLON_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, EXCELLON_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'excellonsoftware')
  assert.equal(provider.companyName, 'Excellon Software')
  assert.equal(provider.officialBrandName, 'Excellon')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.excellonsoft.com/')
  assert.equal(provider.companyCareerPage, 'https://www.excellonsoft.com/about/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-live-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-without-public-job-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+submit-job-application-form+returns-empty-array',
  )
  assert.equal(provider.companyDomain, 'excellonsoft.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Submit Job Application/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /excellonsoftware[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('Excellon Software exact backlog row resolves from the local provider metadata without aliases', async () => {
  const { EXCELLON_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Excellon Software\n',
    catalog: [hydrateProviderCatalogEntry(EXCELLON_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Excellon Software', 'excellonsoftware', 'Excellon Software']],
  )
})
