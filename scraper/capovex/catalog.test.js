import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Capovex is registered as a verified first-party zero-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'capovex')

  assert.ok(provider, 'Expected Capovex provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Capovex')
  assert.equal(provider.companyCareerPage, 'https://capovex.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-shell-plus-sitemap-plus-client-bundle-plus-common-careers-route-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-two-url-sitemap+verified-client-bundle-without-career-routes+verified-common-careers-route-shell-fallbacks',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'capovex.com')
  assert.match(provider.modulePath, /capovex[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Capovex'), false)
})

test('Capovex resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Capovex,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Capovex', 'capovex', 'Capovex']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'capovex')

  assert.ok(scraper, 'Expected buildScrapers() to return the Capovex sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'capovex')
  assert.equal(scraper.provider.companyCareerPage, 'https://capovex.com/')
  assert.match(scraper.dryRunFile, /capovex[\\/]jobs\.json$/i)
})
