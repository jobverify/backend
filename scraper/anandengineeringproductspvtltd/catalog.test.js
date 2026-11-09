import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Anand Engineering Products Pvt Ltd. is registered on its verified first-party native careers source without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anandengineeringproductspvtltd')

  assert.ok(provider, 'Expected Anand Engineering Products Pvt Ltd. provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Anand Engineering Products Pvt Ltd.')
  assert.equal(provider.companyCareerPage, 'https://anandengg.in/open-positions/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'elementor-load-more-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+first-party-listing-cards+job-details',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'anandengg.in')
  assert.equal(provider.homepageUrl, 'https://anandengg.in/')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.modulePath, /anandengineeringproductspvtltd[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Anand Engineering Products Pvt Ltd.'), false)
})

test('Anand Engineering Products Pvt Ltd. matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Anand Engineering Products Pvt Ltd.,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anand Engineering Products Pvt Ltd.', 'anandengineeringproductspvtltd', 'Anand Engineering Products Pvt Ltd.']],
  )
})

test('Anand Engineering Products Pvt Ltd. is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'anandengineeringproductspvtltd')

  assert.ok(scraper, 'Expected buildScrapers() to return the Anand Engineering Products Pvt Ltd. scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'anandengineeringproductspvtltd')
  assert.equal(scraper.provider.companyCareerPage, 'https://anandengg.in/open-positions/')
  assert.match(scraper.dryRunFile, /anandengineeringproductspvtltd[\\/]jobs\.json$/i)
})
