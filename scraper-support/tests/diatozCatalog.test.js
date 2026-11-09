import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('registers DIATOZ as an official careers page source', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'diatoz')

  assert.ok(provider)
  assert.equal(provider.companyName, 'DIATOZ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.diatoz.com/careers')
  assert.equal(provider.companyDomain, 'diatoz.com')
  assert.equal(provider.paginationStrategy, 'public-application-page')
  assert.equal(provider.extractionStrategy, 'official-careers-page+apply-cta-no-public-opening-details')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /diatoz[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'diatoz')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves DIATOZ to the diatoz source', () => {
  const report = generateCompanyCoverageReport({
    csvText: `row,company_name,url_in_text,note
1,DIATOZ,,
`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['DIATOZ', 'diatoz']],
  )
})
