import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getDiskBackedScraperSources } from '../scraper-support/providers/sourceInventory.js'

test('getDiskBackedScraperSources excludes configured providers without a scraper folder', () => {
  const sources = getDiskBackedScraperSources({
    catalog: [
      { source: 'alpha', companyName: 'Alpha Inc.' },
      { source: 'beta', companyName: 'Beta Labs' },
    ],
    scraperDirectories: ['alpha', 'helpers'],
  })

  assert.deepEqual(sources, ['alpha'])
})

test('generateCompanyCoverageReport ignores single-column Company Name headers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Company Name\nAlpha Inc.\n',
    catalog: [
      { source: 'alpha', companyName: 'Alpha Inc.' },
    ],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'alpha')
})
