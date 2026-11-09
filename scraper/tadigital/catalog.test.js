import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('TA Digital is registered as a verified parked-domain sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'tadigital')

  assert.ok(provider, 'Expected TA Digital provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TA Digital')
  assert.equal(provider.companyCareerPage, 'https://ta.digital/careers')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-routes-plus-sitemap-parked-lander-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-route-shells+verified-sitemap-parked-lander-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ta.digital')
  assert.match(provider.modulePath, /tadigital[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TA Digital'), false)
})

test('TA Digital resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'TA Digital,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TA Digital', 'tadigital', 'TA Digital']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'tadigital')

  assert.ok(scraper, 'Expected buildScrapers() to return the TA Digital sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'tadigital')
  assert.equal(scraper.provider.companyCareerPage, 'https://ta.digital/careers')
  assert.match(scraper.dryRunFile, /tadigital[\\/]jobs\.json$/i)
})
