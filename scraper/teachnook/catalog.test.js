import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Teachnook is registered as a verified first-party parked-lander sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'teachnook')

  assert.ok(provider, 'Expected Teachnook provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Teachnook')
  assert.equal(provider.companyCareerPage, 'https://teachnook.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-route-plus-parked-lander-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-route+verified-first-party-parked-lander-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'teachnook.in')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.officialCareersPageUrl, 'https://teachnook.in/careers')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /teachnook\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /teachnook\.com/i)
  assert.match(provider.modulePath, /teachnook[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Teachnook'), false)
})

test('Teachnook resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Teachnook,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Teachnook', 'teachnook', 'Teachnook']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'teachnook')

  assert.ok(scraper, 'Expected buildScrapers() to return the Teachnook sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'teachnook')
  assert.equal(scraper.provider.companyCareerPage, 'https://teachnook.in/careers')
  assert.match(scraper.dryRunFile, /teachnook[\\/]jobs\.json$/i)
})
