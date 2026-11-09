import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Jyesta Corporate Entity is registered as a direct first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jyesta')

  assert.ok(provider, 'Expected Jyesta provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'Jyesta Corporate Entity')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jyesta.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-cards+same-page-detail-toggles',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jyesta.com')
  assert.match(provider.modulePath, /jyesta[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Jyesta Corporate Entity'), false)
})

test('Jyesta Corporate Entity matches backlog coverage directly from provider metadata and is runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: '"Jyesta Corporate Entity"\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jyesta Corporate Entity', 'jyesta', 'Jyesta Corporate Entity']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'jyesta')

  assert.ok(scraper, 'Expected buildScrapers() to return the Jyesta scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jyesta')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.jyesta.com/careers')
  assert.match(scraper.dryRunFile, /jyesta[\\/]jobs\.json$/i)
})
