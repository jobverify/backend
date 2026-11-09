import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('eizen is registered with the verified first-party careers page and no alias requirement', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'eizen')

  assert.ok(provider, 'Expected eizen provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'eizen')
  assert.equal(provider.companyCareerPage, 'https://eizen.ai/careers.html')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-first-party-careers-page-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-public-openings+verified-missing-jobs-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'eizen.ai')
  assert.match(provider.modulePath, /eizen[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'eizen'), false)
})

test('eizen matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'eizen,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['eizen', 'eizen', 'eizen']],
  )
})

test('eizen is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'eizen')

  assert.ok(scraper, 'Expected buildScrapers() to return the eizen scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'eizen')
  assert.equal(scraper.provider.companyCareerPage, 'https://eizen.ai/careers.html')
  assert.match(scraper.dryRunFile, /eizen[\\/]jobs\.json$/i)
})
