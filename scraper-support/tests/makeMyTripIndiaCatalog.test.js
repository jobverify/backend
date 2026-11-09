import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/makemytrip/catalog.js')
  } catch {
    assert.fail('Expected MakeMyTrip catalog module at ../../scraper/makemytrip/catalog.js')
  }
}

test('MakeMyTrip India resolves to the shared MakeMyTrip provider without a duplicate provider or alias edit', async () => {
  const { MAKEMYTRIP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MakeMyTrip India\n',
    catalog: [hydrateProviderCatalogEntry(MAKEMYTRIP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MakeMyTrip India', 'makemytrip', 'MakeMyTrip']],
  )
})
