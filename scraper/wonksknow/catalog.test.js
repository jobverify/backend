import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Wonksknow is registered against the verified Vinterview overview and detail surfaces', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'wonksknow')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Wonksknow')
  assert.equal(provider.companyCareerPage, 'https://vinterview.ai/wonksknowllc/overview')
  assert.equal(provider.atsPlatform, 'Vinterview')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'homepage-plus-vinterview-overview-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-vinterview-overview+public-job-detail-pages+apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'wonksknow.com')
  assert.match(provider.modulePath, /wonksknow[\\/]script\.js$/i)
})

test('Wonksknow matches company coverage directly and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Wonksknow\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Wonksknow', 'wonksknow', 'Wonksknow']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'wonksknow')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'wonksknow')
  assert.equal(scraper.provider.companyCareerPage, 'https://vinterview.ai/wonksknowllc/overview')
  assert.match(scraper.dryRunFile, /wonksknow[\\/]jobs\.json$/i)
})
