import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

const COMPANY_CSV_TEXT = "company_name\nChargePoint\n"

test('ChargePoint resolves only to its exact-name official provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'chargepoint')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nChargePoint Technologies\nChargePoint India\n',
    catalog,
  })

  assert.ok(provider, 'Expected ChargePoint provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'ChargePoint')
  assert.equal(provider.companyDomain, 'chargepoint.com')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.boardToken, 'chargepoint')
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'ChargePoint').map((item) => item.source),
    ['chargepoint'],
  )
  assert.deepEqual(nearNameReport.matched, [])
  assert.deepEqual(
    nearNameReport.unmatched.map((item) => item.companyName),
    ['ChargePoint Technologies', 'ChargePoint India'],
  )
})

test('ChargePoint uses its verified Greenhouse feed and returns real India roles', async () => {
  const scraper = buildScrapers().find((item) => item.name === 'chargepoint')

  assert.ok(scraper, 'Expected ChargePoint scraper to be built from its provider extension')
  const jobs = await scraper.run({ fetchJson: async () => ({ jobs: [{
    id: 8826763002, title: 'Software Engineer', location: { name: 'Bangalore, India' },
    absolute_url: 'https://job-boards.greenhouse.io/chargepoint/jobs/8826763002',
    content: 'Design and develop charging software with our engineering team.',
  }], meta: { total: 1 } }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'chargepoint')
  assert.equal(jobs[0].company, 'ChargePoint')
})
