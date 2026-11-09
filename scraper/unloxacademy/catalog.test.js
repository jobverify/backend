import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Unlox Academy is registered as a verified first-party launch-splash sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'unloxacademy')

  assert.ok(provider, 'Expected Unlox Academy provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Unlox Academy')
  assert.equal(provider.companyCareerPage, 'https://unloxacademy.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-index-plus-homepage-sitemap-plus-missing-careers-routes')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-launch-splash+verified-sitemap-index+verified-homepage-sitemap+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'unloxacademy.com')
  assert.match(provider.modulePath, /unloxacademy[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Unlox Academy'), false)
})

test('Unlox Academy resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Unlox Academy,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Unlox Academy', 'unloxacademy', 'Unlox Academy']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'unloxacademy')

  assert.ok(scraper, 'Expected buildScrapers() to return the Unlox Academy sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'unloxacademy')
  assert.equal(scraper.provider.companyCareerPage, 'https://unloxacademy.com/')
  assert.match(scraper.dryRunFile, /unloxacademy[\\/]jobs\.json$/i)
})
