import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MyWays.ai is registered as a verified first-party zero-job scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mywaysai')

  assert.ok(provider, 'Expected MyWays.ai provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MyWays.ai')
  assert.equal(provider.companyCareerPage, 'https://myways.ai/technology-jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-opportunity-handoff-plus-public-zero-job-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-opportunity-handoff-bundle+verified-technology-jobs-zero-jobs+verified-type-routes-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'myways.ai')
  assert.match(provider.modulePath, /mywaysai[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MyWays.ai'), false)
})

test('MyWays.ai matches coverage directly from the exact CSV row and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'MyWays.ai,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MyWays.ai', 'mywaysai', 'MyWays.ai']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'mywaysai')

  assert.ok(scraper, 'Expected buildScrapers() to return the MyWays.ai scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mywaysai')
  assert.equal(scraper.provider.companyCareerPage, 'https://myways.ai/technology-jobs')
  assert.match(scraper.dryRunFile, /mywaysai[\\/]jobs\.json$/i)
})
