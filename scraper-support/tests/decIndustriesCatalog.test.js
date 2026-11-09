import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes DEC Industries as an official careers script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'decindustries')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'DEC Industries')
  assert.equal(provider.companyCareerPage, 'https://decindustries.in/careers')
  assert.equal(provider.companyDomain, 'decindustries.in')
  assert.match(provider.modulePath, /decindustries[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable DEC Industries scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'decindustries')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'decindustries')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /decindustries[\\/]jobs\.json$/i)
})

test('DEC INDUSTRIES resolves in coverage reports from the provider catalog without an alias override', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'DEC INDUSTRIES,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['DEC INDUSTRIES', 'decindustries']],
  )
})
