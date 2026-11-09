import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('iNurture Education Solutions Pvt ltd is registered as a verified first-party email-only zero-job scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'inurtureeducationsolutionspvtltd')

  assert.ok(provider, 'Expected iNurture Education Solutions Pvt ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iNurture Education Solutions Pvt ltd')
  assert.equal(provider.companyCareerPage, 'https://www.inurture.co.in/careers-inurture/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-email-only-careers-page-plus-first-party-iframe-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-email-only-careers-page+verified-first-party-iframe-handoff-zero-jobs',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'inurture.co.in')
  assert.match(provider.modulePath, /inurtureeducationsolutionspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iNurture Education Solutions Pvt ltd'), false)
})

test('iNurture Education Solutions Pvt ltd matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'iNurture Education Solutions Pvt ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iNurture Education Solutions Pvt ltd', 'inurtureeducationsolutionspvtltd', 'iNurture Education Solutions Pvt ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'inurtureeducationsolutionspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the iNurture Education Solutions Pvt ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'inurtureeducationsolutionspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.inurture.co.in/careers-inurture/')
  assert.match(scraper.dryRunFile, /inurtureeducationsolutionspvtltd[\\/]jobs\.json$/i)
})
