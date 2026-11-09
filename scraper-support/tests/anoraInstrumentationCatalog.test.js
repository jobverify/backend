import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Anora Instrumentation Private Limited as an official first-party careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anorainstrumentation')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Anora Instrumentation Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://anoralabs.com/careers.html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'anoralabs.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /anorainstrumentation[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve Anora Instrumentation Private Limited to the anorainstrumentation source', () => {
  const scraper = buildScrapers().find((item) => item.name === 'anorainstrumentation')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /anorainstrumentation[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'anorainstrumentation')

  const report = generateCompanyCoverageReport({
    csvText: 'Anora Instrumentation Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anora Instrumentation Private Limited', 'anorainstrumentation', 'Anora Instrumentation Private Limited']],
  )
})
