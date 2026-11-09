import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport, getCompanyAliasMap } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'

test('retired classification sources cannot be scheduled by the scraper runner', () => {
  const sources = new Set(['ibm', 'detroitengineeredproducts', 'orangebusiness'])
  assert.deepEqual(getScraperCatalog().filter(provider => sources.has(provider.source)), [])
  assert.deepEqual(buildScrapers().filter(scraper => sources.has(scraper.name)), [])
})

test('removed company names and aliases cannot resolve to an active scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Company Name\nIBM\nDetroit Engineered Products\nDetroit Engineering\nOrange Business\n',
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })
  assert.equal(report.matchedCount, 0)
  assert.equal(report.unmatchedCount, 4)
})
