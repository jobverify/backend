import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/perennialsystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/perennialsystems/catalog.js')
  } catch {
    assert.fail('Expected Perennial Systems catalog module at ../../scraper/perennialsystems/catalog.js')
  }
}

test('Perennial Systems local catalog captures the verified coming-soon fail-closed contract', async () => {
  const { PERENNIAL_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PERENNIAL_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, PERENNIAL_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'perennialsystems')
  assert.equal(provider.companyName, 'Perennial Systems')
  assert.equal(provider.companyCareerPage, 'https://perennialsys.com/careers/')
  assert.equal(provider.officialJobOpeningsPageUrl, 'https://perennialsys.com/job-openings')
  assert.equal(provider.atsPlatform, 'official-company-careers-coming-soon')
  assert.equal(provider.paginationStrategy, 'careers-shell-plus-coming-soon-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+verified-job-openings-coming-soon+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Coming Soon/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Perennial Systems exact backlog row resolves from the local provider metadata', async () => {
  const { PERENNIAL_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Perennial Systems\n',
    catalog: [hydrateProviderCatalogEntry(PERENNIAL_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
