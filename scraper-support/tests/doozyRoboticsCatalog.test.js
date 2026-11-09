import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers Doozy Robotics as an official careers application-form source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'doozyrobotics')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Doozy Robotics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.doozyrobotics.com/career.html')
  assert.equal(provider.companyDomain, 'doozyrobotics.com')
  assert.equal(provider.paginationStrategy, 'public-application-form')
  assert.equal(provider.extractionStrategy, 'official-career-form+public-position-options-no-opening-details')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /doozyrobotics[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'doozyrobotics')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Doozy Robotics to the Doozy Robotics source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Doozy Robotics,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['Doozy Robotics', 'doozyrobotics']],
  )
})
