import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('CRMIT Solutions is registered as an official careers scraper', () => {
  const catalog = getScraperCatalog()
  const crmit = catalog.find((provider) => provider.source === 'crmit')

  assert.ok(crmit)
  assert.equal(crmit.adapter, 'script')
  assert.equal(crmit.companyName, 'CRMIT Solutions')
  assert.equal(crmit.atsPlatform, 'official-company-careers')
  assert.equal(crmit.companyCareerPage, 'https://www.crmit.com/careers/job-search.html')
  assert.equal(crmit.companyDomain, 'crmit.com')
  assert.match(crmit.modulePath, /crmit[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'crmit')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves CRMIT aliases to the CRMIT scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note\n1,CRMIT Solutions,,\n2,CRMIT,,\n3,CRMIT Solutions Pvt Ltd,,`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['CRMIT Solutions', 'crmit'],
      ['CRMIT', 'crmit'],
      ['CRMIT Solutions Pvt Ltd', 'crmit'],
    ],
  )
})
