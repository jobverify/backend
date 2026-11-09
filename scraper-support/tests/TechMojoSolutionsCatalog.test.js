import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techmojosolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techmojosolutions/catalog.js')
  } catch {
    assert.fail('Expected TechMojo Solutions catalog module at ../../scraper/techmojosolutions/catalog.js')
  }
}

test('TechMojo Solutions local catalog captures the verified first-party careers handoff and 9am jobs payload', async () => {
  const { TECHMOJO_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHMOJO_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, TECHMOJO_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'techmojosolutions')
  assert.equal(provider.companyName, 'TechMojo Solutions')
  assert.equal(provider.companyCareerPage, 'https://techmojo.com/company/careers/')
  assert.equal(provider.publicJobsUrl, 'https://9am.careers/')
  assert.equal(provider.publicCompanyBoardUrl, 'https://9am.careers/jobs/techmojo-solutions/')
  assert.equal(provider.atsPlatform, '9am-careers-public-payload')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-handoff-plus-complete-9am-company-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-techmojo-careers-page+company-board-jobsdata+matching-detail-payloads+explicit-country-filter',
  )
  assert.equal(provider.verifiedOn, '2026-10-19')
  assert.match(provider.verifiedSurfaceSummary, /October 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/techmojo\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/9am\.careers\//i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /techmojosolutions[\\/]jobs\.json$/i)
})

test('TechMojo Solutions exact backlog row resolves from the local provider metadata', async () => {
  const { TECHMOJO_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TechMojo Solutions\n',
    catalog: [hydrateProviderCatalogEntry(TECHMOJO_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
