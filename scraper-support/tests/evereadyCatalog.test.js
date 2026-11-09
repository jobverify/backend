import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Eveready as an official careers application-form scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'eveready')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyName, 'Eveready Industries India Limited')
  assert.equal(provider.companyCareerPage, 'https://www.eveready.in/talent/')
  assert.equal(provider.companyDomain, 'eveready.in')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /eveready[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Eveready scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'eveready')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.parser, 'custom-script')
  assert.match(scraper.dryRunFile, /eveready[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Eveready Industries India Limited to the Eveready provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Eveready Industries India Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eveready Industries India Limited', 'eveready', 'Eveready Industries India Limited']],
  )
})
