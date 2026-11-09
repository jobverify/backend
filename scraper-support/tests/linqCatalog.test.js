import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const linqModulePath = path.resolve(currentDir, '../../scraper/linq/script.js')

const loadLinqCatalog = async () => {
  try {
    return await import('../../scraper/linq/catalog.js')
  } catch {
    assert.fail('Expected Linq catalog module at ../../scraper/linq/catalog.js')
  }
}

test('Linq catalog captures the verified first-party company-filtered public board surface', async () => {
  const { LINQ_CATALOG } = await loadLinqCatalog()
  const provider = hydrateProviderCatalogEntry(LINQ_CATALOG)

  assert.equal(provider.source, 'linq')
  assert.equal(provider.companyName, 'Linq')
  assert.equal(provider.officialBrandName, 'linq')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://app.linq.co/en/company/1')
  assert.equal(provider.officialHomepageUrl, 'https://linq.co/en/')
  assert.equal(provider.officialCompanyPageUrl, 'https://app.linq.co/en/company/1')
  assert.equal(provider.officialJobBoardUrl, 'https://app.linq.co/en/job-board')
  assert.equal(provider.apiBaseUrl, 'https://app.linq.co/b/api')
  assert.equal(provider.jobSearchApiUrl, 'https://app.linq.co/b/api/job-board/search')
  assert.equal(provider.jobDetailApiBaseUrl, 'https://app.linq.co/b/api/job-board/job')
  assert.equal(provider.companyId, 1)
  assert.equal(provider.verifiedPublicJobCount, 14)
  assert.equal(provider.verifiedExactCompanyJobCount, 6)
  assert.equal(provider.companyDomain, 'linq.co')
  assert.equal(provider.atsPlatform, 'linq-job-board')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'official-company-filtered-search-api-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-search-api+official-detail-api+exclude-client-and-partner-handoff-roles',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, linqModulePath)
  assert.match(provider.dryRunFile, /linq[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/linq\.co\/en\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/app\.linq\.co\/en\/company\/1/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/app\.linq\.co\/en\/job-board/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/app\.linq\.co\/b\/api\/job-board\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /\b14 public jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b6 exact-company jobs\b/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Linq'), false)
})

test('Linq backlog row matches directly from provider metadata without a shared alias entry', async () => {
  const { LINQ_CATALOG } = await loadLinqCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Linq\n',
    catalog: [hydrateProviderCatalogEntry(LINQ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Linq', 'linq', 'Linq']],
  )
})
