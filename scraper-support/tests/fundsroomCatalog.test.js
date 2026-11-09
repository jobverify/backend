import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Fundsroom as a LinkedIn guest-search script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'fundsroom')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Fundsroom')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/fundsroom/jobs/')
  assert.equal(provider.companyDomain, 'fundsroom.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /fundsroom[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Fundsroom scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'fundsroom')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.match(scraper.dryRunFile, /fundsroom[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Fundsroom to the Fundsroom provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Fundsroom,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fundsroom', 'fundsroom', 'Fundsroom']],
  )
})
