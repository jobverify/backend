import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dyninnoindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dyninnoindia/catalog.js')
  } catch {
    assert.fail('Expected Dyninno India catalog module at ../../scraper/dyninnoindia/catalog.js')
  }
}

test('Dyninno India local catalog captures the verified first-party India office jobs page', async () => {
  const { DYNINNO_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DYNINNO_INDIA_CATALOG)

  assert.equal(defaultCatalog, DYNINNO_INDIA_CATALOG)
  assert.equal(provider.source, 'dyninnoindia')
  assert.equal(provider.companyName, 'Dyninno India')
  assert.equal(provider.companyCareerPage, 'https://dyninno.com/en/offices/india/')
  assert.equal(provider.atsPlatform, 'first-party-office-jobs-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-office-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-office-page+inline-job-cards',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.companyDomain, 'dyninno.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote Freelance Travel Consultant \| Dreamport/i)
  assert.match(provider.verifiedSurfaceSummary, /TRAVEL SALES CONSULTANT/i)
})

test('Dyninno India exact backlog row resolves from the local catalog object', async () => {
  const { DYNINNO_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dyninno India\n',
    catalog: [hydrateProviderCatalogEntry(DYNINNO_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
