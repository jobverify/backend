import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SuryaLogix is registered as a verified first-party popup discovery with unknown vacancy counts without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'suryalogix')

  assert.ok(provider, 'Expected SuryaLogix provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SuryaLogix')
  assert.equal(provider.companyCareerPage, 'https://suryalogix.com/career-opportunities/')
  assert.equal(provider.atsPlatform, 'first-party-careers-application-popup')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-popup-position-selector-and-hidden-archive-discovery-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+careers-hidden-archive+verified-popup63761-form63770+position-selector-association+incomplete-discovery',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'suryalogix.com')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'discovery-only')
  assert.match(provider.verifiedSurfaceSummary, /counts remain unknown/i)
  assert.match(provider.modulePath, /suryalogix[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SuryaLogix'), false)
})

test('SuryaLogix resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SuryaLogix,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SuryaLogix', 'suryalogix', 'SuryaLogix']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'suryalogix')

  assert.ok(scraper, 'Expected buildScrapers() to return the SuryaLogix sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'suryalogix')
  assert.equal(scraper.provider.companyCareerPage, 'https://suryalogix.com/career-opportunities/')
  assert.match(scraper.dryRunFile, /suryalogix[\\/]jobs\.json$/i)
})
