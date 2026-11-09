import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MMRFIC is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mmrfic')

  assert.ok(provider, 'Expected MMRFIC provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MMRFIC')
  assert.equal(provider.companyCareerPage, 'https://mmrfic.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+no-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mmrfic.com')
  assert.match(provider.modulePath, /mmrfic[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MMRFIC'), false)
})

test('MMRFIC matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'MMRFIC,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MMRFIC', 'mmrfic', 'MMRFIC']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'mmrfic')

  assert.ok(scraper, 'Expected buildScrapers() to return the MMRFIC scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mmrfic')
  assert.equal(scraper.provider.companyCareerPage, 'https://mmrfic.com/careers/')
  assert.match(scraper.dryRunFile, /mmrfic[\\/]jobs\.json$/i)
})

