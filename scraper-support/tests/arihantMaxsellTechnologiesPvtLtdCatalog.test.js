import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Arihant Maxsell Technologies Pvt Ltd is registered against the verified first-party Maxsell jobs surface without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arihantmaxselltechnologiespvtltd')

  assert.ok(provider, 'Expected Arihant Maxsell Technologies Pvt Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Arihant Maxsell Technologies Pvt Ltd')
  assert.equal(provider.companyCareerPage, 'https://maxsell.co.in/current-openings/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-plus-current-openings-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-careers-handoff+verified-current-openings-loop-cards+same-domain-detail-pages+inline-apply-form+filled-role-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'maxsell.co.in')
  assert.match(provider.modulePath, /arihantmaxselltechnologiespvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Arihant Maxsell Technologies Pvt Ltd'), false)
})

test('Arihant Maxsell Technologies Pvt Ltd matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Arihant Maxsell Technologies Pvt Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arihant Maxsell Technologies Pvt Ltd', 'arihantmaxselltechnologiespvtltd', 'Arihant Maxsell Technologies Pvt Ltd']],
  )
})

test('Arihant Maxsell Technologies Pvt Ltd is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'arihantmaxselltechnologiespvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Arihant Maxsell Technologies Pvt Ltd scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'arihantmaxselltechnologiespvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://maxsell.co.in/current-openings/')
  assert.match(scraper.dryRunFile, /arihantmaxselltechnologiespvtltd[\\/]jobs\.json$/i)
})
