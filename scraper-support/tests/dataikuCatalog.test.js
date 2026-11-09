import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dataiku/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dataiku/catalog.js')
  } catch {
    assert.fail('Expected Dataiku catalog module at ../../scraper/dataiku/catalog.js')
  }
}

test('Dataiku catalog captures the verified first-party careers handoff to the official Greenhouse board', async () => {
  const { DATAIKU_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DATAIKU_CATALOG)

  assert.equal(defaultCatalog, DATAIKU_CATALOG)
  assert.equal(provider.source, 'dataiku')
  assert.equal(provider.companyName, 'Dataiku')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.dataiku.com/company/careers')
  assert.equal(provider.companyDomain, 'dataiku.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-board-feed-current-empty-india-slice')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+official-greenhouse-board+official-greenhouse-board-api+india-filter+empty-india-slice-contract',
  )
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dataiku\.com\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /job-boards\.greenhouse\.io\/dataiku/i)
  assert.match(provider.verifiedSurfaceSummary, /\b24 jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)
})

test('Dataiku exact-name backlog coverage resolves directly from the local catalog without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDataiku\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dataiku', 'dataiku', 'Dataiku']],
  )
})

test('buildScrapers exposes a runnable Dataiku scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'dataiku')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /dataiku[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'dataiku')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.dataiku.com/company/careers')
})
