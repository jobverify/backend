import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Mywaggle as a verified no-public-careers scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mywaggle')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Mywaggle')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://mywaggle.com/')
  assert.equal(provider.companyDomain, 'mywaggle.com')
  assert.match(provider.modulePath, /mywaggle[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Mywaggle scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'mywaggle')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /mywaggle[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'mywaggle')
})

test('generateCompanyCoverageReport resolves the CSV row Mywaggle to the Mywaggle scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mywaggle,\n',
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
    [['Mywaggle', 'mywaggle', 'Mywaggle']],
  )
})
