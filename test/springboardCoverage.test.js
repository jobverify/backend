import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('Springboard resolves only to its exact-name first-party provider', () => {
  const exactReport = generateCompanyCoverageReport({
    csvText: 'company_name\nSpringboard\n',
    catalog: getScraperCatalog(),
  })
  const distinctCompanyReport = generateCompanyCoverageReport({
    csvText: 'company_name\nSpringboard Enterprises\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    exactReport.matched.map((item) => [item.companyName, item.source, item.provider?.companyName]),
    [['Springboard', 'springboard', 'Springboard']],
  )
  assert.equal(exactReport.unmatchedCount, 0)
  assert.equal(distinctCompanyReport.matchedCount, 0)
  assert.equal(distinctCompanyReport.unmatchedCount, 1)
})
