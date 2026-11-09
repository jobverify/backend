import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Bira 91 is registered as a verified first-party 404 sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bira91')

  assert.ok(provider, 'Expected Bira 91 provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Bira 91')
  assert.equal(provider.companyCareerPage, 'https://bira91.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-404-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-404+verified-common-careers-routes-404-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'bira91.com')
  assert.match(provider.modulePath, /bira91[\\/]script\.js$/i)
})

test('Bira 91 matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Bira 91,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bira 91', 'bira91', 'Bira 91']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'bira91')

  assert.ok(scraper, 'Expected buildScrapers() to return the Bira 91 scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bira91')
  assert.equal(scraper.provider.companyCareerPage, 'https://bira91.com/')
  assert.match(scraper.dryRunFile, /bira91[\\/]jobs\.json$/i)
})
