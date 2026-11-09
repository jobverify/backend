import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Movate as an official careers page scraper with first-party ASP.NET portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'movate')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Movate')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-first-party-aspnet-careers')
  assert.equal(provider.companyCareerPage, 'https://www.movate.com/careers-at-movate/')
  assert.equal(provider.companyDomain, 'movate.com')
  assert.equal(provider.linkedJobsBoardUrl, 'https://movatecareers.movate.com/MovateJobOpenings')
  assert.equal(provider.paginationStrategy, 'all-dom-cards-client-side-pagination')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedPublicJobCount, 424)
  assert.equal(provider.verifiedIndiaJobCount, 301)
  assert.match(provider.modulePath, /movate[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Movate scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'movate')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /movate[\\/]jobs\.json$/)
  assert.equal(scraper.provider.source, 'movate')
})

test('generateCompanyCoverageReport resolves the CSV row Movate to the Movate scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Movate,\n',
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
    [['Movate', 'movate', 'Movate']],
  )
})
