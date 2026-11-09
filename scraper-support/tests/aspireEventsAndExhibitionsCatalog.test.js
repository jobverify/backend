import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Aspire Events & Exhibitions is registered as a verified first-party empty-shell sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aspireeventsandexhibitions')

  assert.ok(provider, 'Expected Aspire Events & Exhibitions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Aspire Events & Exhibitions')
  assert.equal(provider.companyCareerPage, 'https://www.aspireevents.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-checked-first-party-route-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-sitemap-without-careers+verified-first-party-route-shells+no-public-job-records',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'aspireevents.in')
  assert.match(provider.modulePath, /aspireeventsandexhibitions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aspire Events & Exhibitions'), false)
})

test('Aspire Events & Exhibitions matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Aspire Events & Exhibitions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aspire Events & Exhibitions', 'aspireeventsandexhibitions', 'Aspire Events & Exhibitions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'aspireeventsandexhibitions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Aspire Events & Exhibitions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'aspireeventsandexhibitions')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.aspireevents.in/')
  assert.match(scraper.dryRunFile, /aspireeventsandexhibitions[\\/]jobs\.json$/i)
})
