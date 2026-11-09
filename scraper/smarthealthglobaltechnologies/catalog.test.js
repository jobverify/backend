import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Smart Health Global Technologies is registered as a verified legacy-bridge no-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'smarthealthglobaltechnologies')

  assert.ok(provider, 'Expected Smart Health Global Technologies provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Smart Health Global Technologies')
  assert.equal(provider.companyCareerPage, 'https://shgtechnologies.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'legacy-bridge-plus-homepage-about-sitemap-and-missing-careers-routes-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-legacy-bridge+verified-first-party-marketing-pages+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'shgtechnologies.com')
  assert.match(provider.modulePath, /smarthealthglobaltechnologies[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Smart Health Global Technologies'), false)
})

test('Smart Health Global Technologies matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Smart Health Global Technologies,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Smart Health Global Technologies', 'smarthealthglobaltechnologies', 'Smart Health Global Technologies']],
  )
})

test('Smart Health Global Technologies is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'smarthealthglobaltechnologies')

  assert.ok(scraper, 'Expected buildScrapers() to return the Smart Health Global Technologies sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'smarthealthglobaltechnologies')
  assert.equal(scraper.provider.companyCareerPage, 'https://shgtechnologies.com/')
  assert.match(scraper.dryRunFile, /smarthealthglobaltechnologies[\\/]jobs\.json$/i)
})
