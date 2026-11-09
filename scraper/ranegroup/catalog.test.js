import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Rane Group is registered as a verified first-party zero-public-careers sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ranegroup')

  assert.ok(provider, 'Expected Rane Group provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rane Group')
  assert.equal(provider.companyCareerPage, 'https://ranegroup.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-robots-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page-without-public-jobs+verified-robots+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ranegroup.com')
  assert.match(provider.modulePath, /ranegroup[\\/]script\.js$/i)
})

test('Rane Group resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Rane Group,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rane Group', 'ranegroup', 'Rane Group']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ranegroup')

  assert.ok(scraper, 'Expected buildScrapers() to return the Rane Group sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ranegroup')
  assert.equal(scraper.provider.companyCareerPage, 'https://ranegroup.com/careers/')
  assert.match(scraper.dryRunFile, /ranegroup[\\/]jobs\.json$/i)
})
