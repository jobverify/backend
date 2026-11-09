import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rajasoftwarelabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rajasoftwarelabs/catalog.js')
  } catch {
    assert.fail('Expected Raja Software Labs catalog module at ../../scraper/rajasoftwarelabs/catalog.js')
  }
}

test('Raja Software Labs local catalog captures the verified first-party current openings contract', async () => {
  const { RAJA_SOFTWARE_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAJA_SOFTWARE_LABS_CATALOG)

  assert.equal(defaultCatalog, RAJA_SOFTWARE_LABS_CATALOG)
  assert.equal(provider.source, 'rajasoftwarelabs')
  assert.equal(provider.companyName, 'Raja Software Labs')
  assert.equal(provider.companyCareerPage, 'https://rajasoftwarelabs.com/careers/current-openings')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-current-openings-list')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-openings-shell+anchor-list-extraction+static-pune-location',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer – Android/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer – Web Frontend/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Raja Software Labs exact backlog row resolves from the local provider metadata', async () => {
  const { RAJA_SOFTWARE_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Raja Software Labs\n',
    catalog: [hydrateProviderCatalogEntry(RAJA_SOFTWARE_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
