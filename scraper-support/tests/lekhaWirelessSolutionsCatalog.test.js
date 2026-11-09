import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Lekha Wireless Solutions is registered as a verified first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lekhawirelesssolutions')

  assert.ok(provider, 'Expected Lekha Wireless Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lekha Wireless Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.lekhawireless.com/company/contact-us/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-careers-page-plus-shared-onsite-apply-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+accordion-job-listings+shared-onsite-resume-upload-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lekhawireless.com')
  assert.match(provider.modulePath, /lekhawirelesssolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Lekha Wireless Solutions'), false)
})

test('Lekha Wireless Solutions matches coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Lekha Wireless Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lekha Wireless Solutions', 'lekhawirelesssolutions', 'Lekha Wireless Solutions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'lekhawirelesssolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lekha Wireless Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lekhawirelesssolutions')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://www.lekhawireless.com/company/contact-us/careers/',
  )
  assert.match(scraper.dryRunFile, /lekhawirelesssolutions[\\/]jobs\.json$/i)
})
