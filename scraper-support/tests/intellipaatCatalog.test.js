import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Intellipaat is registered against the verified first-party jobs subdomain', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intellipaat')

  assert.ok(provider, 'Expected Intellipaat provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Intellipaat')
  assert.equal(provider.companyCareerPage, 'https://intellipaat.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-subdomain')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-redirect+first-party-html-job-cards+detail-jsonld',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'intellipaat.com')
  assert.match(provider.modulePath, /intellipaat[\\/]script\.js$/i)
})

test('Intellipaat closes backlog coverage directly from provider metadata and stays runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Intellipaat,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Intellipaat', 'intellipaat', 'Intellipaat']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'intellipaat')

  assert.ok(scraper, 'Expected buildScrapers() to return the Intellipaat scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intellipaat')
  assert.equal(scraper.provider.companyCareerPage, 'https://intellipaat.com/careers/')
  assert.match(scraper.dryRunFile, /intellipaat[\\/]jobs\.json$/i)
})
