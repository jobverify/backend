import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('VU-DYNAMICS Private Limited is registered against its verified first-party careers API without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'vudynamicsprivatelimited')

  assert.ok(provider, 'Expected VU-DYNAMICS Private Limited provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'VU-DYNAMICS Private Limited')
  assert.equal(provider.companyCareerPage, 'https://vudynamics.co.in/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-first-party-wordpress-page-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+verified-wordpress-page-api+inline-role-blocks+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'vudynamics.co.in')
  assert.match(provider.modulePath, /vudynamicsprivatelimited[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'VU-DYNAMICS Private Limited'), false)
})

test('VU-DYNAMICS Private Limited resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'VU-DYNAMICS Private Limited,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['VU-DYNAMICS Private Limited', 'vudynamicsprivatelimited', 'VU-DYNAMICS Private Limited']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'vudynamicsprivatelimited')

  assert.ok(scraper, 'Expected buildScrapers() to return the VU-DYNAMICS Private Limited scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'vudynamicsprivatelimited')
  assert.equal(scraper.provider.companyCareerPage, 'https://vudynamics.co.in/careers/')
  assert.match(scraper.dryRunFile, /vudynamicsprivatelimited[\\/]jobs\.json$/i)
})
