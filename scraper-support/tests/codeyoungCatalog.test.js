import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers Codeyoung as an official mentor-application source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'codeyoung')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Codeyoung')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.codeyoung.com/trainer-register')
  assert.equal(provider.companyDomain, 'codeyoung.com')
  assert.equal(provider.paginationStrategy, 'public-application-form')
  assert.equal(provider.extractionStrategy, 'official-mentor-application-form+no-public-job-records')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /codeyoung[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'codeyoung')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Codeyoung brand variants to the Codeyoung source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Codeyoung,,
2,Code Young,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Codeyoung', 'codeyoung'],
      ['Code Young', 'codeyoung'],
    ],
  )
})
