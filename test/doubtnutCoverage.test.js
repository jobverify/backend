import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/doubtnut/script.js'

test('Doubtnut resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nDoubtnut\nDoubtnut Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Doubtnut', 'doubtnut', 'Doubtnut']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Doubtnut Technologies'],
  )
})

test('Doubtnut reports a coverage gap when native transport fails', async () => {
  await assert.rejects(run({ fetchImpl: async () => { throw new Error('offline') } }), { code: 'DOUBTNUT_COVERAGE_GAP' })
})
