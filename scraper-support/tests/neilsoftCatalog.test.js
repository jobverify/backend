import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }

test('Neilsoft Ltd is registered against the verified first-party India openings surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neilsoft')

  assert.ok(provider, 'Expected Neilsoft provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Neilsoft Ltd')
  assert.equal(provider.companyCareerPage, 'https://neilsoft.com/careers/current-job-openings-india')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-careers-landing-plus-india-openings-plus-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-landing+verified-india-openings+detail-pages+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'neilsoft.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Verified on Friday, August 7, 2026/i)
  assert.match(provider.modulePath, /neilsoft[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Neilsoft Ltd'), false)
})

test('Neilsoft Ltd matches the backlog directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Neilsoft Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Neilsoft Ltd', 'neilsoft', 'Neilsoft Ltd']],
  )
})

test('Neilsoft is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'neilsoft')

  assert.ok(scraper, 'Expected buildScrapers() to return the Neilsoft scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neilsoft')
  assert.equal(scraper.provider.companyCareerPage, 'https://neilsoft.com/careers/current-job-openings-india')
  assert.match(scraper.dryRunFile, /neilsoft[\\/]jobs\.json$/i)
})
