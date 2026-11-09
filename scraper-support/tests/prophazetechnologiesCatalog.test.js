import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Prophaze Technologies is registered against the verified first-party public jobs surface without alias drift', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'prophazetechnologies')

  assert.ok(provider, 'Expected Prophaze Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Prophaze Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.prophaze.com/company/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-plus-wordpress-jobs-api-plus-detail-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+same-domain-job-links+first-party-wordpress-job-index+detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'prophaze.com')
  assert.match(provider.modulePath, /prophazetechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Prophaze Technologies'), false)
})

test('Prophaze Technologies matches the backlog directly from provider metadata and is runnable through the catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Prophaze Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Prophaze Technologies', 'prophazetechnologies', 'Prophaze Technologies']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'prophazetechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Prophaze Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'prophazetechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.prophaze.com/company/careers/')
  assert.match(scraper.dryRunFile, /prophazetechnologies[\\/]jobs\.json$/i)
})
