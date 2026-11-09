import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Home Ideas Technologies is registered as a verified first-party empty-shell sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'homeideastechnologies')

  assert.ok(provider, 'Expected Home Ideas Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Home Ideas Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.homeideastechnologies.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-route-shells+no-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'homeideastechnologies.com')
  assert.match(provider.modulePath, /homeideastechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Home Ideas Technologies'), false)
})

test('Home Ideas Technologies matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Home Ideas Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Home Ideas Technologies', 'homeideastechnologies', 'Home Ideas Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'homeideastechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Home Ideas Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'homeideastechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.homeideastechnologies.com/')
  assert.match(scraper.dryRunFile, /homeideastechnologies[\\/]jobs\.json$/i)
})
