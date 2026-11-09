import test from 'node:test'
import assert from 'node:assert/strict'

import { run } from './script.js'
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

test('reports a coverage gap when the official EaseMyTrip surface is unavailable', async () => {
  await assert.rejects(run({fetchImpl:async url=>({status:503,url,text:async()=>''})}),{code:'EASEMYTRIP_COVERAGE_GAP'})
})

test('matches the exact EaseMyTrip company name in coverage', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nEaseMyTrip\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].companyName, 'EaseMyTrip')
  assert.equal(report.matched[0].source, 'easemytrip')
})
