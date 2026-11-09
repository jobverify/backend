import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('INTRAINZ INNOVATION PRIVATE LIMITED is registered as a verified first-party zero-job shell without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intrainzinnovationprivatelimited')

  assert.ok(provider, 'Expected INTRAINZ INNOVATION PRIVATE LIMITED provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'INTRAINZ INNOVATION PRIVATE LIMITED')
  assert.equal(provider.companyCareerPage, 'https://www.intrainz.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-routes-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-repurposed-shell+verified-common-careers-routes-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'intrainz.com')
  assert.match(provider.modulePath, /intrainzinnovationprivatelimited[\\/]script\.js$/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'INTRAINZ INNOVATION PRIVATE LIMITED'),
    false,
  )
})

test('INTRAINZ INNOVATION PRIVATE LIMITED matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'INTRAINZ INNOVATION PRIVATE LIMITED,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'INTRAINZ INNOVATION PRIVATE LIMITED',
      'intrainzinnovationprivatelimited',
      'INTRAINZ INNOVATION PRIVATE LIMITED',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'intrainzinnovationprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the intrainzinnovationprivatelimited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intrainzinnovationprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.intrainz.com/')
  assert.match(scraper.dryRunFile, /intrainzinnovationprivatelimited[\\/]jobs\.json$/i)
})
