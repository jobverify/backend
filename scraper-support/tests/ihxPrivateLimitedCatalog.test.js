import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('IHX Private Limited is registered as a verified first-party careers-section sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ihxprivatelimited')

  assert.ok(provider, 'Expected IHX Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IHX Private Limited')
  assert.equal(provider.companyCareerPage, 'https://www.ihx.in/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-homepage-careers-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-section+linkedin-handoff-no-first-party-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ihx.in')
  assert.match(provider.modulePath, /ihxprivatelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'IHX Private Limited'), false)
})

test('IHX Private Limited matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'IHX Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IHX Private Limited', 'ihxprivatelimited', 'IHX Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ihxprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the IHX Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ihxprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.ihx.in/')
  assert.match(scraper.dryRunFile, /ihxprivatelimited[\\/]jobs\.json$/i)
})
