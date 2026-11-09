import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes UST as an official RippleHire-backed script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ust')

  assert.ok(provider)
  assert.equal(provider.companyName, 'UST')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'ripplehire')
  assert.equal(provider.companyCareerPage, 'https://www.ust.com/en/careers')
  assert.equal(provider.companyDomain, 'ust.com')
})

test('buildScrapers exposes a runnable UST scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ust')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ust[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'ust')
  assert.equal(scraper.provider.atsPlatform, 'ripplehire')
})

test('generateCompanyCoverageReport resolves the CSV row UST to the UST scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'UST,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['UST', 'ust', 'UST']],
  )
})
