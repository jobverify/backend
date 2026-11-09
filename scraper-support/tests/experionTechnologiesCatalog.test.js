import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Experion Technologies is registered against the official first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'experiontechnologies')

  assert.ok(provider, 'Expected Experion Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Experion Technologies')
  assert.equal(provider.companyCareerPage, 'https://experionglobal.com/job-openings/')
  assert.equal(provider.atsPlatform, 'custom')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'all-server-rendered-cards-native-client-side-load-more-contract+stable-final-listing')
  assert.equal(
    provider.extractionStrategy,
    'current-active-corporate-handoff+reviewed-native-client-pagination+all-full-role-pages+identity-location-apply-form-and-native-page-dates',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'experionglobal.com')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, 'https://experionglobal.com/')
  assert.ok(provider.bindingEvidence.matchedLinks.includes(provider.companyCareerPage))
  assert.match(provider.modulePath, /experiontechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Experion Technologies'), false)
})

test('Experion Technologies matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Experion Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Experion Technologies', 'experiontechnologies', 'Experion Technologies']],
  )
})

test('Experion Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'experiontechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Experion Technologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'experiontechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://experionglobal.com/job-openings/')
  assert.match(scraper.dryRunFile, /experiontechnologies[\\/]jobs\.json$/i)
})
