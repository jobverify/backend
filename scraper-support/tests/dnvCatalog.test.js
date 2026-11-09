import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('DNV is registered as an official Oracle Cloud script provider', () => {
  const catalog = getScraperCatalog()
  const dnv = catalog.find((provider) => provider.source === 'dnv')

  assert.ok(dnv)
  assert.equal(dnv.adapter, 'script')
  assert.equal(dnv.atsPlatform, 'oracle-cloud')
  assert.equal(dnv.companyCareerPage, 'https://jobs.dnv.com/job-search')
  assert.equal(dnv.companyDomain, 'jobs.dnv.com')
  assert.match(dnv.modulePath, /dnv[\\/]script\.js$/)

  const scraper = buildScrapers().find((candidate) => candidate.name === 'dnv')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})

test('company coverage resolves DNV and its Det Norske Veritas alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'row,companyName,urlInText,note\n1,DNV,,\n2,Det Norske Veritas,,',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => item.source), ['dnv', 'dnv'])
})
