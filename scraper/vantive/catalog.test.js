import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Vantive is registered as an India TalentBrew scraper with verified careers metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vantive')

  assert.ok(provider, 'Expected Vantive provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Vantive')
  assert.equal(
    provider.companyCareerPage,
    'https://jobs.vantive.com/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D',
  )
  assert.equal(provider.atsPlatform, 'talentbrew-radancy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-query')
  assert.equal(provider.extractionStrategy, 'india-search-page-plus-detail-jsonld-and-workday-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'jobs.vantive.com')
  assert.match(provider.modulePath, /vantive[\\/]script\.js$/i)
})

test('Vantive resolves through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Vantive,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Vantive', 'vantive', 'Vantive']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vantive')

  assert.ok(scraper, 'Expected buildScrapers() to return the Vantive scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vantive')
  assert.equal(scraper.provider.companyName, 'Vantive')
  assert.match(scraper.dryRunFile, /vantive[\\/]jobs\.json$/i)
})
