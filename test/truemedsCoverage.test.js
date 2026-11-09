import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { run } from '../scraper/truemeds/script.js'

test('Truemeds resolves only the exact CSV company name to its official employer provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTruemeds\nTruemeds India\n',
    catalog: getScraperCatalog(),
    aliasMap: {},
  })

  const provider = getScraperCatalog().find((item) => item.source === 'truemeds')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Truemeds')
  assert.equal(provider.companyDomain, 'truemeds.in')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Truemeds', 'truemeds']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['Truemeds India'],
  )
})

test('Truemeds reports unavailable native recruiting as a coverage gap', async () => {
  await assert.rejects(run({fetchImpl:async url=>({status:503,url,text:async()=>'<h1>Unavailable</h1>'})}),{code:'TRUEMEDS_COVERAGE_GAP'})
})
