import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('RoboMQ resolves only its exact company name', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nRoboMQ\nRoboMQ Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName]),
    [['RoboMQ', 'robomq', 'RoboMQ']],
  )
  assert.deepEqual(
    report.unmatched.map((item) => item.companyName),
    ['RoboMQ Technologies'],
  )
})

test('RoboMQ reports unavailable native recruiting as a coverage gap', async () => {
  const { run } = await import('../scraper/robomq/script.js')

  await assert.rejects(run({fetchImpl:async()=>({status:503,url:'https://www.robomq.io/',text:async()=>''})}),{code:'ROBOMQ_COVERAGE_GAP'})
})
