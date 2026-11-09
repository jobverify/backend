import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers D. E. Shaw India against its official public careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'deshawindia')

  assert.ok(provider)
  assert.equal(provider.companyName, 'D. E. Shaw India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.deshawindia.com/careers')
  assert.equal(provider.companyDomain, 'deshawindia.com')
  assert.equal(provider.paginationStrategy, 'single-server-rendered-listing-page')
  assert.equal(provider.extractionStrategy, 'official-html-job-cards')
  assert.match(provider.modulePath, /deshawindia[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'deshawindia')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves D. E. Shaw spelling variants to the D. E. Shaw India source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,D. E. Shaw India,,
2,D E Shaw,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [
      ['D. E. Shaw India', 'deshawindia'],
      ['D E Shaw', 'deshawindia'],
    ],
  )
})
