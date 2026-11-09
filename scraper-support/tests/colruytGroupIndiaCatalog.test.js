import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('catalog registers Colruyt Group India against its official public Zoho careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'colruytgroupindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Colruyt Group India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'zoho-recruit-career-site')
  assert.equal(provider.companyCareerPage, 'https://careers.in.colruytgroup.com/jobs/careers')
  assert.equal(provider.companyDomain, 'careers.in.colruytgroup.com')
  assert.match(provider.modulePath, /colruytgroupindia[\\/]script\.js$/i)
  assert.equal(typeof buildScrapers().find((item) => item.name === 'colruytgroupindia')?.run, 'function')
})

test('company coverage resolves Colruyt Group India aliases to the official scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Colruyt Group India\n2,Colruyt IT Consultancy India Pvt. Ltd.',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(report.matched.map((item) => item.source), [
    'colruytgroupindia',
    'colruytgroupindia',
  ])
  assert.equal(report.unmatchedCount, 0)
})
