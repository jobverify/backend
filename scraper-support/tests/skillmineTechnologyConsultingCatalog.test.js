import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Skillmine Technology Consulting is registered with its official public careers page', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'skillminetechnologyconsulting')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Skillmine Technology Consulting')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://skill-mine.com/career/')
  assert.equal(provider.companyDomain, 'skill-mine.com')
  assert.equal(provider.paginationStrategy, 'single-public-careers-page')
  assert.equal(provider.extractionStrategy, 'html-job-cards+shared-application-form')

  const scraper = buildScrapers().find((item) => item.name === 'skillminetechnologyconsulting')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Skillmine Technology Consulting to its scraper without aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Skillmine Technology Consulting\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Skillmine Technology Consulting', 'skillminetechnologyconsulting']],
  )
})
