import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

test('company coverage resolves Data Patterns to the official scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name,url_in_text,note\n1,Data Patterns,,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].companyName, 'Data Patterns')
  assert.equal(report.matched[0].normalizedCompanyName, 'data patterns')
  assert.equal(report.matched[0].source, 'datapatterns')
  assert.equal(report.matched[0].provider.companyCareerPage, 'https://www.datapatternsindia.com/careers/current-openings.php')
})
