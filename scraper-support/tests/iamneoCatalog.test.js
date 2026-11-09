import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('iamneo is registered as a verified first-party careers shell sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iamneo')

  assert.ok(provider, 'Expected iamneo provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iamneo')
  assert.equal(provider.companyCareerPage, 'https://iamneo.ai/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-external-ats-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+external-keka-handoff-no-first-party-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iamneo.ai')
  assert.match(provider.modulePath, /iamneo[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iamneo'), false)
})

test('iamneo matches the backlog directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'iamneo,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iamneo', 'iamneo', 'iamneo']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'iamneo')

  assert.ok(scraper, 'Expected buildScrapers() to return the iamneo scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iamneo')
  assert.equal(scraper.provider.companyCareerPage, 'https://iamneo.ai/careers/')
  assert.match(scraper.dryRunFile, /iamneo[\\/]jobs\.json$/i)
})
