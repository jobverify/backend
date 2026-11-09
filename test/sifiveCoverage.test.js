import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nSiFive\n"

test('SiFive is covered by its exact-name official Workday provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'sifive')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nSi Five\nSiFive Labs\n',
    catalog,
  })

  assert.ok(provider, 'Expected SiFive provider extension in the scraper catalog')
  assert.equal(provider.adapter, 'workday')
  assert.equal(provider.companyName, 'SiFive')
  assert.equal(provider.companyDomain, 'sifive.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.baseUrl, 'https://sifive.wd1.myworkdayjobs.com/en-US/sifivecareers')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'SiFive').map((item) => item.source),
    ['sifive'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('SiFive Workday scraper is built from the provider extension', () => {
  const scraper = buildScrapers().find((item) => item.name === 'sifive')

  assert.ok(scraper, 'Expected SiFive scraper to be built from its provider extension')
  assert.equal(scraper.provider.adapter, 'workday')
})
