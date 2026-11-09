import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('WeRize is registered as a LinkedIn-backed scraper with verified public-company metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'werize')

  assert.ok(provider, 'Expected WeRize provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'WeRize')
  assert.equal(provider.companyCareerPage, 'https://in.linkedin.com/company/werize')
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-company-jobs-page')
  assert.equal(provider.extractionStrategy, 'public-company-page+guest-search+public-detail-jsonld')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'werize.com')
  assert.match(provider.modulePath, /werize[\\/]script\.js$/i)
})

test('WeRize resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'WeRize,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['WeRize', 'werize', 'WeRize']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'werize')

  assert.ok(scraper, 'Expected buildScrapers() to return the WeRize scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'werize')
  assert.equal(scraper.provider.companyName, 'WeRize')
  assert.match(scraper.dryRunFile, /werize[\\/]jobs\.json$/i)
})
