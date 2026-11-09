import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog registers Coditas Solutions LLP with its official careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'coditas')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Coditas Solutions LLP')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-coditas-job-openings-api')
  assert.equal(provider.companyCareerPage, 'https://www.coditas.com/careers/job-opportunities')
  assert.equal(provider.companyDomain, 'coditas.com')
  assert.match(provider.modulePath, /coditas[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'coditas')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Coditas Solutions LLP and Coditas aliases', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Coditas Solutions LLP,,
2,Coditas,,`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Coditas Solutions LLP', 'coditas'],
      ['Coditas', 'coditas'],
    ],
  )
})
