import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nEnphase\n"

test('Enphase keeps its exact-name Jobvite provider while adjacent exact company names resolve separately', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'enphase')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nEnphase Energy\nEnphase India\n',
    catalog,
  })

  assert.ok(provider, 'Expected Enphase provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Enphase')
  assert.equal(provider.companyDomain, 'enphase.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'jobvite')
  assert.equal(provider.officialCareersHandoffUrl, 'https://jobs.jobvite.com/enphase-energy/jobs')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Enphase').map((item) => item.source),
    ['enphase'],
  )
  assert.deepEqual(
    nearNameReport.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Enphase Energy', 'enphaseenergy', 'Enphase Energy']],
  )
  assert.deepEqual(nearNameReport.unmatched.map((item) => item.companyName), ['Enphase India'])
})

test('Enphase scraper is registered from its provider extension', () => {
  const scraper = buildScrapers().find((item) => item.name === 'enphase')

  assert.ok(scraper, 'Expected Enphase scraper to be built from its provider extension')
  assert.equal(scraper.provider.adapter, 'script')
})
