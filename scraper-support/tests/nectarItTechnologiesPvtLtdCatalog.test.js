import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('NectarIt Technologies Pvt Ltd. is registered as a verified first-party zero-job scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nectarittechnologiespvtltd')

  assert.ok(provider, 'Expected NectarIt Technologies Pvt Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NectarIt Technologies Pvt Ltd.')
  assert.equal(provider.companyCareerPage, 'https://www.nectarit.com/about')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage-plus-about-page-careers-contact-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nectarit.com')
  assert.match(provider.modulePath, /nectarittechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NectarIt Technologies Pvt Ltd.'), false)
})

test('NectarIt Technologies Pvt Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'NectarIt Technologies Pvt Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NectarIt Technologies Pvt Ltd.', 'nectarittechnologiespvtltd', 'NectarIt Technologies Pvt Ltd.']],
  )
})

test('NectarIt Technologies Pvt Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nectarittechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the NectarIt Technologies Pvt Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nectarittechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.nectarit.com/about')
  assert.match(scraper.dryRunFile, /nectarittechnologiespvtltd[\\/]jobs\.json$/i)
})
