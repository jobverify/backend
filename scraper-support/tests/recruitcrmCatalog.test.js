import assert from 'node:assert/strict'
import test from 'node:test'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('getScraperCatalog includes Recruit CRM as an official Recruit CRM careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'recruitcrm')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Recruit CRM')
  assert.equal(provider.companyCareerPage, 'https://recruitcrm.io/careers/')
  assert.equal(provider.atsPlatform, 'recruitcrm-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'recruitcrm.io')
  assert.match(provider.modulePath, /recruitcrm[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Recruit CRM'), false)
})

test('buildScrapers exposes a runnable Recruit CRM scraper', () => {
  const scraper = buildScrapers().find((item) => item.name === 'recruitcrm')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'recruitcrm')
  assert.equal(scraper.provider.atsPlatform, 'recruitcrm-careers')
  assert.match(scraper.dryRunFile, /recruitcrm[\\/]jobs\.json$/i)
})

test('company coverage resolves the exact CSV company name Recruit CRM without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Recruit CRM\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Recruit CRM', 'recruitcrm', 'recruitcrm']],
  )
  assert.equal(report.unmatchedCount, 0)
})
