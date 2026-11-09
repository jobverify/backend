import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Ninjacart as a Darwinbox script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ninjacart')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Ninjacart')
  assert.equal(provider.companyCareerPage, 'https://ninjacart.com/careers/')
  assert.equal(provider.companyDomain, 'ninjacart.com')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /ninjacart[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Ninjacart script scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ninjacart')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /ninjacart[\\/]jobs\.json$/)
})

test('generateCompanyCoverageReport resolves Ninjacart to the Ninjacart provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Ninjacart,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ninjacart', 'ninjacart', 'Ninjacart']],
  )
})
