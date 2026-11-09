import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/pocketfm/script.js'

test('Pocket FM resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPocket FM\nPocket FM Technologies\nPocket FM Studios\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pocket FM', 'pocketfm', 'Pocket FM']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Pocket FM Technologies', 'Pocket FM Studios'],
  )
})

test('Pocket FM propagates official inventory failures instead of an unobserved zero', async () => {
  await assert.rejects(run({ fetchText: async () => { throw Error('Pocket FM official source unavailable') } }), /official source unavailable/)
})
