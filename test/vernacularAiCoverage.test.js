import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

test('Vernacular.ai and Vernacular AI resolve to the shared official SmartRecruiters provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nVernacular.ai\nVernacular AI\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Vernacular.ai', 'vernacularai', 'Vernacular.ai'],
      ['Vernacular AI', 'vernacularai', 'Vernacular.ai'],
    ],
  )
  assert.deepEqual(report.unmatched, [])
})
