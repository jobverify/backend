import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/jungleworks/script.js'

test('Jungleworks resolves only to its exact-name provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nJungleworks\nJungleworks Software\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jungleworks', 'jungleworks', 'Jungleworks']],
  )
})

test('Jungleworks rejects unavailable official inventory instead of certifying zero', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw new Error('offline fixture') } }), /offline fixture/)
})
