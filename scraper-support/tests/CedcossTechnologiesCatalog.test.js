import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cedcosstechnologies/catalog.js')
  } catch {
    assert.fail('Expected Cedcoss Technologies catalog module at ../../scraper/cedcosstechnologies/catalog.js')
  }
}

test('Cedcoss Technologies local catalog captures the verified first-party listing and detail routes', async () => {
  const { CEDCOSS_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CEDCOSS_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'cedcosstechnologies')
  assert.equal(provider.companyName, 'Cedcoss Technologies')
  assert.equal(provider.companyCareerPage, 'https://cedcoss.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.verifiedSurfaceSummary, /\/careers\/sales-executive/i)
})

test('Cedcoss Technologies backlog row matches directly through the local catalog', async () => {
  const { CEDCOSS_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cedcoss Technologies\n',
    catalog: [hydrateProviderCatalogEntry(CEDCOSS_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
