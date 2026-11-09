import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Engineers India Limited as a verified legacy-portal-or-main-domain sentinel', () => {
  const catalog = getScraperCatalog()
  const eil = catalog.find((provider) => provider.source === 'engineersindialimited')

  assert.ok(eil)
  assert.equal(eil.adapter, 'script')
  assert.equal(eil.officialBrandName, 'EIL')
  assert.equal(eil.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(eil.homepageUrl, 'https://www.engineersindia.com/')
  assert.equal(eil.companyCareerPage, 'https://www.engineersindia.com/careers')
  assert.equal(eil.applyingPageUrl, 'https://www.engineersindia.com/applying-to-eil')
  assert.equal(eil.legacyRecruitmentPortalUrl, 'https://recruitment.eil.co.in/')
  assert.equal(eil.companyDomain, 'engineersindia.com')
  assert.equal(eil.countryFilter, 'India')
  assert.equal(
    eil.paginationStrategy,
    'legacy-recruitment-portal-or-validated-main-site-careers-route-check',
  )
  assert.equal(
    eil.extractionStrategy,
    'verified-legacy-recruitment-portal-openings-or-verified-homepage-careers-applying-pages-without-public-openings-return-empty',
  )
  assert.equal(eil.parser, 'custom-script')
  assert.equal(eil.verifiedOn, '2026-08-15')
  assert.equal(eil.verifiedPublicJobCount, 0)
  assert.equal(eil.verifiedIndiaJobCount, 0)
  assert.match(eil.verifiedSurfaceSummary, /https:\/\/recruitment\.eil\.co\.in\//i)
  assert.match(eil.verifiedSurfaceSummary, /https:\/\/www\.engineersindia\.com\/careers/i)
  assert.match(eil.verifiedSurfaceSummary, /Opportunities@EIL/i)
  assert.match(eil.verifiedSurfaceSummary, /No Fee is Payable/i)
  assert.match(eil.verifiedSurfaceSummary, /BEWARE OF FRAUDULENT WEBSITES \/ EMAILS/i)
  assert.match(eil.modulePath, /engineersindialimited[\\/]script\.js$/i)
  assert.match(eil.dryRunFile, /engineersindialimited[\\/]jobs\.json$/i)
})

test('buildScrapers exposes a runnable Engineers India Limited script scraper without changing the runner contract', () => {
  const scrapers = buildScrapers()
  const eil = scrapers.find((scraper) => scraper.name === 'engineersindialimited')

  assert.ok(eil)
  assert.equal(typeof eil.run, 'function')
  assert.equal(eil.provider.adapter, 'script')
  assert.equal(eil.provider.parser, 'custom-script')
  assert.equal(eil.provider.companyCareerPage, 'https://www.engineersindia.com/careers')
  assert.equal(eil.provider.legacyRecruitmentPortalUrl, 'https://recruitment.eil.co.in/')
  assert.match(eil.dryRunFile, /engineersindialimited[\\/]jobs\.json$/i)
})
