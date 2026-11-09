import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'pixbot'
const COMPANY = 'Pixbot'
const HOMEPAGE_URL = 'https://pixbot.co/'

test('Pixbot is registered as a verified first-party no-public-careers sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Pixbot provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, HOMEPAGE_URL)
  assert.deepEqual(provider.alternateCareerPages, [
    'https://pixbot.co/about/',
    'https://pixbot.co/contact/',
    'https://pixbot.co/page-sitemap.xml',
    'https://pixbot.co/careers/',
    'https://pixbot.co/career/',
    'https://pixbot.co/jobs/',
    'https://pixbot.co/join-us/',
    'https://pixbot.co/work-with-us/',
    'https://pixbot.co/openings/',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'homepage-plus-about-contact-sitemap-and-missing-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page+verified-page-sitemap+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pixbot.co')
  assert.match(provider.modulePath, /pixbot[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Pixbot resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Pixbot sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, HOMEPAGE_URL)
  assert.match(scraper.dryRunFile, /pixbot[\\/]jobs\.json$/i)
})
