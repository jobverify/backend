import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('InMovidu Technologies Pvt Ltd is registered as an unresolved-host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'inmovidutechnologiespvtltd')

  assert.ok(provider, 'Expected InMovidu Technologies Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'InMovidu Technologies Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://inmovidu.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'canonical-first-party-host-resolution-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-unresolved-first-party-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'inmovidu.com')
  assert.match(provider.modulePath, /inmovidutechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'InMovidu Technologies Pvt Ltd'), false)
})

test('InMovidu Technologies Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'InMovidu Technologies Pvt Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['InMovidu Technologies Pvt Ltd', 'inmovidutechnologiespvtltd', 'InMovidu Technologies Pvt Ltd']],
  )
})

test('InMovidu Technologies Pvt Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'inmovidutechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the InMovidu Technologies Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'inmovidutechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://inmovidu.com/')
  assert.match(scraper.dryRunFile, /inmovidutechnologiespvtltd[\\/]jobs\.json$/i)
})
