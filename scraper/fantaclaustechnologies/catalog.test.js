import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('fantaclaustechnologies is registered with the verified InteligenAI careers page and no alias requirement', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'fantaclaustechnologies')

  assert.ok(provider, 'Expected fantaclaustechnologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Fantaclaus Technologies')
  assert.equal(provider.companyCareerPage, 'https://inteligenai.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legal-domain-redirect-plus-homepage-plus-page-sitemap-plus-careers-alias-and-missing-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-legal-domain-redirect+verified-branded-homepage+verified-page-sitemap+verified-first-party-careers-page+inline-public-openings+google-form-apply-links+verified-careers-alias+verified-missing-jobs-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'inteligenai.com')
  assert.match(provider.modulePath, /fantaclaustechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fantaclaus Technologies'), false)
})

test('fantaclaustechnologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Fantaclaus Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fantaclaus Technologies', 'fantaclaustechnologies', 'Fantaclaus Technologies']],
  )
})

test('fantaclaustechnologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'fantaclaustechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the fantaclaustechnologies scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'fantaclaustechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://inteligenai.com/careers/')
  assert.match(scraper.dryRunFile, /fantaclaustechnologies[\\/]jobs\.json$/i)
})
