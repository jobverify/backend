import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/foiweinfoglobalsolution/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/foiweinfoglobalsolution/catalog.js')
  } catch {
    assert.fail('Expected Foiwe Info Global Solution catalog module at ../../scraper/foiweinfoglobalsolution/catalog.js')
  }
}

test('Foiwe Info Global Solution local catalog captures the verified first-party careers accordion contract', async () => {
  const { FOIWE_INFO_GLOBAL_SOLUTION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FOIWE_INFO_GLOBAL_SOLUTION_CATALOG)

  assert.equal(defaultCatalog, FOIWE_INFO_GLOBAL_SOLUTION_CATALOG)
  assert.equal(provider.source, 'foiweinfoglobalsolution')
  assert.equal(provider.companyName, 'Foiwe Info Global Solution')
  assert.equal(provider.officialBrandName, 'Foiwe Info Global Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.foiwe.com/career/')
  assert.equal(provider.companyDomain, 'foiwe.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-accordion')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-accordion-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-accordion+learn-more-detail-pages+join-our-team-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /HR Recruiter/i)
  assert.match(provider.verifiedSurfaceSummary, /Full-Stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Japanese Social Media Manager/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /foiweinfoglobalsolution[\\/]jobs\.json$/i)
})

test('Foiwe Info Global Solution exact backlog row resolves from local provider metadata', async () => {
  const { FOIWE_INFO_GLOBAL_SOLUTION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Foiwe Info Global Solution\n',
    catalog: [hydrateProviderCatalogEntry(FOIWE_INFO_GLOBAL_SOLUTION_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Foiwe Info Global Solution', 'foiweinfoglobalsolution', 'Foiwe Info Global Solution']],
  )
})

test('Foiwe Info Global Solution hydrated local catalog stays script-runner compatible', async () => {
  const { FOIWE_INFO_GLOBAL_SOLUTION_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FOIWE_INFO_GLOBAL_SOLUTION_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.foiwe.com/career/')
  assert.equal(typeof module.run, 'function')
})
