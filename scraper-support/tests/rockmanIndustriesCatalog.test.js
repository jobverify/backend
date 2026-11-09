import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Rockman Industries as a Darwinbox script provider with official metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'rockmanindustries')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'Rockman Industries')
  assert.equal(provider.companyCareerPage, 'https://www.rockman.in/career/')
  assert.equal(provider.companyDomain, 'rockman.in')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'darwinbox-alljobs-api-via-hosted-origin')
  assert.equal(provider.parser, 'custom-script')
  assert.match(provider.modulePath, /rockmanindustries[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Rockman Industries scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'rockmanindustries')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.adapter, 'script')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /rockmanindustries[\\/]jobs\.json$/i)
})

test('generateCompanyCoverageReport resolves the exact Rockman Industries CSV name to the Rockman provider', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Rockman Industries,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rockman Industries', 'rockmanindustries', 'Rockman Industries']],
  )
})
