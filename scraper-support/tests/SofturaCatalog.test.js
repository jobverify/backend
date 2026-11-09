import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/softura/catalog.js')
  } catch {
    assert.fail('Expected Softura catalog module at ../../scraper/softura/catalog.js')
  }
}

test('Softura local catalog captures the verified same-page India listings', async () => {
  const { SOFTURA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SOFTURA_CATALOG)

  assert.equal(provider.source, 'softura')
  assert.equal(provider.companyName, 'Softura')
  assert.equal(provider.companyCareerPage, 'https://www.softura.com/careers/')
  assert.equal(provider.atsPlatform, 'first-party-inline-job-listings-plus-zoho-links')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /33 distinct India job rows/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 429/i)
})

test('Softura backlog row matches directly through the local catalog', async () => {
  const { SOFTURA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Softura\n',
    catalog: [hydrateProviderCatalogEntry(SOFTURA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
