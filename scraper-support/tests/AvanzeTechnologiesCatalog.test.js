import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/avanzetechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/avanzetechnologies/catalog.js')
  } catch {
    assert.fail('Expected Avanze Technologies catalog module at ../../scraper/avanzetechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Avanze Technologies local catalog captures the first-party careers page contact handoff with no trustworthy public openings list', async () => {
  const { AVANZE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(AVANZE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, AVANZE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'avanzetechnologies')
  assert.equal(provider.companyName, 'Avanze Technologies')
  assert.equal(provider.officialBrandName, 'Avanze Group')
  assert.equal(provider.companyCareerPage, 'https://www.avanzegroup.com/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-contact-handoff-return-empty')
  assert.equal(provider.extractionStrategy, 'verified-careers-page+contact-handoff-button+no-trustworthy-public-openings-list')
  assert.equal(provider.companyDomain, 'avanzegroup.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /contact\.php/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public openings list/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Avanze Technologies exact backlog row resolves from the local provider contract', async () => {
  const { AVANZE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Avanze Technologies\n',
    catalog: [buildProvider(AVANZE_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
