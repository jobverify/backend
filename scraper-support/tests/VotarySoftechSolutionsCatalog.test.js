import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/votarysoftechsolutions/catalog.js')
  } catch {
    assert.fail('Expected Votary Softech Solutions catalog module at ../../scraper/votarysoftechsolutions/catalog.js')
  }
}

test('Votary Softech Solutions local catalog captures the verified first-party careers page', async () => {
  const { VOTARY_SOFTECH_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(VOTARY_SOFTECH_SOLUTIONS_CATALOG)

  assert.equal(provider.source, 'votarysoftechsolutions')
  assert.equal(provider.companyName, 'Votary Softech Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.votarytech.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer \/ WLAN Testing/i)
})

test('Votary Softech Solutions backlog row matches directly through the local catalog', async () => {
  const { VOTARY_SOFTECH_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Votary Softech Solutions\n',
    catalog: [hydrateProviderCatalogEntry(VOTARY_SOFTECH_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
