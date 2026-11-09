import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const aliasRecommendation = {
  'Neysa Networks': 'neysa',
  'Neysa Networks Private Limited': 'neysa',
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/neysa/catalog.js')
  } catch {
    assert.fail('Expected Neysa catalog module at ../../scraper/neysa/catalog.js')
  }
}

test('Neysa Networks exact-name coverage is satisfied by the Neysa careers surface without a duplicate provider', async () => {
  const { NEYSA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Neysa Networks\nNeysa Networks Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(NEYSA_CATALOG)],
    aliasMap: aliasRecommendation,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Neysa Networks', 'neysa', 'Neysa'],
      ['Neysa Networks Private Limited', 'neysa', 'Neysa'],
    ],
  )
  assert.equal(companyAliases['Neysa Networks'], 'neysa')
  assert.equal(companyAliases['Neysa Networks Private Limited'], 'neysa')
})
