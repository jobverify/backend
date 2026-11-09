import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Decimal Point is registered with its official careers source and aliases', () => {
  const catalog = getScraperCatalog()
  const decimalPoint = catalog.find((provider) => provider.source === 'decimalpoint')

  assert.ok(decimalPoint)
  assert.equal(decimalPoint.adapter, 'script')
  assert.equal(decimalPoint.atsPlatform, 'hono-careers-api')
  assert.equal(decimalPoint.companyCareerPage, 'https://decimalpointanalytics.com/careers/current-openings')
  assert.equal(decimalPoint.companyDomain, 'decimalpointanalytics.com')
  assert.match(decimalPoint.modulePath, /decimalpoint[\\/]script\.js$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Decimal Point Analytics,,\n2,Decimal Point,,\n3,Decimal Point Analytics Pvt Ltd,,',
    catalog,
  })
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Decimal Point Analytics', 'decimalpoint'],
    ['Decimal Point', 'decimalpoint'],
    ['Decimal Point Analytics Pvt Ltd', 'decimalpoint'],
  ])
})

test('buildScrapers exposes a runnable Decimal Point scraper', () => {
  const decimalPoint = buildScrapers().find((scraper) => scraper.name === 'decimalpoint')

  assert.ok(decimalPoint)
  assert.equal(typeof decimalPoint.run, 'function')
  assert.match(decimalPoint.dryRunFile, /decimalpoint[\\/]jobs\.json$/)
})
