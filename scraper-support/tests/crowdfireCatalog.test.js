import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const createCrowdfireProvider = () => hydrateProviderCatalogEntry({
  source: 'crowdfire',
  companyName: 'Crowdfire',
  adapter: 'script',
  modulePath: '../../scraper/crowdfire/script.js',
  companyCareerPage: 'https://www.crowdfireapp.com/careers',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-common-careers-route-validation',
  extractionStrategy: 'verified-official-homepage-shell+verified-common-careers-route-shells-without-public-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'crowdfireapp.com',
})

test('hydrateProviderCatalogEntry preserves Crowdfire metadata as a verified empty-board script provider', () => {
  const provider = createCrowdfireProvider()

  assert.equal(provider.source, 'crowdfire')
  assert.equal(provider.companyName, 'Crowdfire')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.companyCareerPage, 'https://www.crowdfireapp.com/careers')
  assert.equal(provider.companyDomain, 'crowdfireapp.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-common-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-shell+verified-common-careers-route-shells-without-public-jobs-return-empty',
  )
  assert.match(provider.modulePath, /crowdfire[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /crowdfire[\\/]jobs\.json$/i)
})

test('company coverage matches Crowdfire without alias drift when the provider entry is present', () => {
  const provider = createCrowdfireProvider()
  const report = generateCompanyCoverageReport({
    csvText: 'Crowdfire,\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Crowdfire', 'crowdfire', 'Crowdfire']],
  )
})
