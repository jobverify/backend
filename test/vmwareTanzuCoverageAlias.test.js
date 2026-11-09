import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('VMware Tanzu resolves to the verified Broadcom provider through alias extensions', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nVMware Tanzu\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'broadcom')
})
