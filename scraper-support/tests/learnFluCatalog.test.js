import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('LearnFlu is registered as a verified first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'learnflu')

  assert.ok(provider, 'Expected LearnFlu provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'LearnFlu')
  assert.equal(provider.companyCareerPage, 'https://learnflu.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-shared-apply-popup')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-job-cards+shared-onsite-apply-popup',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'learnflu.com')
  assert.match(provider.modulePath, /learnflu[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'LearnFlu'), false)
})

test('LearnFlu matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'LearnFlu,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LearnFlu', 'learnflu', 'LearnFlu']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'learnflu')

  assert.ok(scraper, 'Expected buildScrapers() to return the LearnFlu scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'learnflu')
  assert.equal(scraper.provider.companyCareerPage, 'https://learnflu.com/careers/')
  assert.match(scraper.dryRunFile, /learnflu[\\/]jobs\.json$/i)
})
