import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog registers CoinSwitch against its official Recruiterflow careers board', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'coinswitch')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'recruiterflow')
  assert.equal(provider.companyCareerPage, 'https://recruiterflow.com/coinswitch/jobs')
  assert.equal(provider.companyDomain, 'recruiterflow.com')

  const scraper = buildScrapers().find((item) => item.name === 'coinswitch')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves CoinSwitch aliases to the CoinSwitch scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,CoinSwitch\n2,Coin Switch\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['CoinSwitch', 'coinswitch'],
      ['Coin Switch', 'coinswitch'],
    ],
  )
  assert.equal(report.unmatchedCount, 0)
})
