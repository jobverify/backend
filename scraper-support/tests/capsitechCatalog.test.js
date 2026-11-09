import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers Capsitech as an official careers application-form source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'capsitech')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Capsitech IT Services Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.capsitech.com/career/')
  assert.equal(provider.companyDomain, 'capsitech.com')
  assert.equal(provider.paginationStrategy, 'public-application-form')
  assert.equal(provider.extractionStrategy, 'official-career-page+public-position-options-no-opening-details')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /capsitech[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'capsitech')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves Capsitech brand and legal-entity names to the Capsitech source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,Capsitech,,
2,Capsitech IT Services Private Limited,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['Capsitech', 'capsitech'],
      ['Capsitech IT Services Private Limited', 'capsitech'],
    ],
  )
})
