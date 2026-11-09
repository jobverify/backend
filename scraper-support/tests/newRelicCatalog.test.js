import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('New Relic catalog captures the verified first-party careers handoff to the public Greenhouse board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'newrelic')

  assert.ok(provider)
  assert.equal(provider.source, 'newrelic')
  assert.equal(provider.companyName, 'New Relic')
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.companyCareerPage, 'https://newrelic.com/careers')
  assert.equal(provider.companyDomain, 'newrelic.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-drupal-jobsearchdata+official-greenhouse-board-api+india-filter',
  )
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/newrelic/jobs',
  )
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /newrelic\.com\/careers\?is_bot=true/i)
  assert.match(provider.verifiedSurfaceSummary, /job-boards\.greenhouse\.io\/newrelic/i)
  assert.match(provider.verifiedSurfaceSummary, /Director, Billing/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Financial Compliance Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Fullstack Engineer - Backend focused/i)
})

test('buildScrapers and company coverage resolve New Relic from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'newrelic')

  assert.ok(scraper)
  assert.equal(scraper.provider.adapter, 'apiPortal')
  assert.match(scraper.dryRunFile, /newrelic[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'New Relic\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['New Relic', 'newrelic', 'New Relic']],
  )
})
