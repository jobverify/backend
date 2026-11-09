import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Sybrox Tech Pvt. Ltd. is registered as a partial first-party technology-division own-role scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sybrox')

  assert.ok(provider, 'Expected Sybrox provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sybrox Tech Pvt. Ltd.')
  assert.equal(provider.companyCareerPage, 'https://sybroxtech.com/sybrox%20careers')
  assert.equal(provider.atsPlatform, 'official-employer-division-partial-googleforms')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedObservedIndiaSubsetCount, 12)
  assert.equal(provider.verifiedInventoryStatus, 'coverage-gap')
  assert.match(provider.verificationNotes, /job-specific Chennai/)
  assert.match(provider.verificationNotes, /applicant sign-in/)
  assert.equal(provider.paginationStrategy, 'single-native-own-role-page+full-card-snapshot+partial-scope')
  assert.equal(
    provider.extractionStrategy,
    'employer-authored-division-identity+current-legalbrand-careers-handoff+native-ST-role-ids-full-JD+job-specific-Chennai-workplace+published-applicant-login-forms+partial-no-expiry',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sybroxtech.com')
  assert.match(provider.modulePath, /sybrox[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sybrox Tech Pvt. Ltd.'), false)
})

test('Sybrox Tech Pvt. Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Sybrox Tech Pvt. Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sybrox Tech Pvt. Ltd', 'sybrox', 'Sybrox Tech Pvt. Ltd.']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sybrox')

  assert.ok(scraper, 'Expected buildScrapers() to return the Sybrox scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sybrox')
  assert.equal(scraper.provider.companyCareerPage, 'https://sybroxtech.com/sybrox%20careers')
  assert.match(scraper.dryRunFile, /sybrox[\\/]jobs\.json$/i)
})
