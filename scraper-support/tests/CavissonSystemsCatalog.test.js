import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cavissonsystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cavissonsystems/catalog.js')
  } catch {
    assert.fail('Expected Cavisson Systems catalog module at ../../scraper/cavissonsystems/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Cavisson Systems local catalog captures the verified first-party careers page and India openings archive', async () => {
  const { CAVISSON_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(CAVISSON_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, CAVISSON_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'cavissonsystems')
  assert.equal(provider.companyName, 'Cavisson Systems')
  assert.equal(provider.officialBrandName, 'Cavisson Systems')
  assert.equal(provider.companyCareerPage, 'https://www.cavisson.com/careers-at-cavisson/')
  assert.equal(provider.openingsPageUrl, 'https://www.cavisson.com/category/open-position-india/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'first-party-openings-archive')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+verified-india-openings-archive')
  assert.equal(provider.companyDomain, 'cavisson.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr\. Software Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /JAVA DEVELOPER/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Cavisson Systems exact backlog row resolves from the local provider contract', async () => {
  const { CAVISSON_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cavisson Systems\n',
    catalog: [buildProvider(CAVISSON_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
