import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('MoEVing resolves only the exact CSV company name to its first-party ATS provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMoEVing\nMoove\nMoeve\nMaeving\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MoEVing', 'moeving', 'MoEVing']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Moove', 'Moeve', 'Maeving'],
  )
})

test('MoEVing rejects an unverified official ATS response instead of reporting empty inventory', async () => {
  const { run } = await import('../scraper/moeving/script.js')

  await assert.rejects(run({ fetchText: async () => '<html><title>Careers</title></html>' }), /inventory unverified/)
})
