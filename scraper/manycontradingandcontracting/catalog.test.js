import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'manycontradingandcontracting'
const COMPANY = 'Manycon Trading and Contracting'

test('Manycon Trading and Contracting is registered as a first-party discovery-only provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Manycon Trading and Contracting provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, 'https://manycon.com/')
  assert.deepEqual(provider.alternateCareerPages, [
    'https://manycon.com/about/',
    'https://manycon.com/sitemap_index.xml',
    'https://manycon.com/page-sitemap.xml',
    'https://manycon.com/careers',
    'https://manycon.com/careers/',
    'https://manycon.com/career',
    'https://manycon.com/career/',
    'https://manycon.com/jobs',
    'https://manycon.com/jobs/',
    'https://manycon.com/join-us',
    'https://manycon.com/join-us/',
    'https://manycon.com/work-with-us',
    'https://manycon.com/vacancies',
    'https://manycon.com/current-openings',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-page-plus-sitemaps-and-missing-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-sitemaps+verified-404-careers-routes+no-public-listings-discovery-only-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'manycon.com')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.verifiedSurfaceSummary, /discovery-only evidence, not an authoritative empty-opening statement/i)
  assert.match(provider.modulePath, /manycontradingandcontracting[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Manycon Trading and Contracting resolves directly from provider metadata and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Manycon Trading and Contracting.\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Manycon Trading and Contracting.', SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Manycon Trading and Contracting scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, 'https://manycon.com/')
  assert.match(scraper.dryRunFile, /manycontradingandcontracting[\\/]jobs\.json$/i)
})
