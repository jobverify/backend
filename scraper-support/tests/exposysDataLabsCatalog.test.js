import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Exposys Data Labs as an official careers page scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'exposysdatalabs')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Exposys Data Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://exposysdata.com/careers.html')
  assert.equal(provider.companyDomain, 'exposysdata.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /exposysdatalabs[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Exposys Data Labs scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'exposysdatalabs')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.match(scraper.dryRunFile, /exposysdatalabs[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Exposys Data Labs to the Exposys Data Labs provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Exposys Data Labs,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Exposys Data Labs', 'exposysdatalabs', 'Exposys Data Labs']],
  )
})
