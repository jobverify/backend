import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/greyamp/script.js'

test('Greyamp resolves only to its exact-name first-party provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nGreyamp\nGrey Amp\nGreyamp Consulting\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Greyamp', 'greyamp', 'Greyamp']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Grey Amp', 'Greyamp Consulting'],
  )
})

test('Greyamp rejects an unavailable official careers surface instead of certifying zero', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('unavailable')}}),/unavailable/)
})
