import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/norwintechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/norwintechnologies/catalog.js')
  } catch {
    assert.fail('Expected Norwin Technologies catalog module at ../../scraper/norwintechnologies/catalog.js')
  }
}

test('Norwin Technologies local catalog captures the verified Trakstar jobs surface', async () => {
  const { NORWIN_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NORWIN_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, NORWIN_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'norwintechnologies')
  assert.equal(provider.companyName, 'Norwin Technologies')
  assert.equal(provider.officialBrandName, 'Norwin Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://norwintechnologies.com/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://norwin.hire.trakstar.com/')
  assert.equal(provider.trakstarJobsHost, 'https://norwin.hire.trakstar.com')
  assert.equal(provider.companyDomain, 'norwintechnologies.com')
  assert.equal(provider.atsPlatform, 'trakstar')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-trakstar-board-root')
  assert.equal(provider.extractionStrategy, 'verified-careers-page+norwin-branded-trakstar-board')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /self-redirect loop/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr,\s*Storage Ops/i)
})

test('Norwin Technologies exact backlog row resolves from the local catalog contract', async () => {
  const { NORWIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Norwin Technologies\n',
    catalog: [hydrateProviderCatalogEntry(NORWIN_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
