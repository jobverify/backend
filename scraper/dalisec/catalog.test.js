import assert from 'node:assert/strict'
import test from 'node:test'

import { DALISEC_CATALOG, VERIFIED_SURFACE_SUMMARY } from './catalog.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Dalisec local catalog documents the verified Cloudflare 526 fail-closed contract from Saturday, August 1, 2026', () => {
  assert.equal(DALISEC_CATALOG.source, 'dalisec')
  assert.equal(DALISEC_CATALOG.companyName, 'Dalisec')
  assert.equal(DALISEC_CATALOG.officialBrandName, 'Dalisec')
  assert.equal(DALISEC_CATALOG.homepageUrl, 'https://dalisec.com/')
  assert.equal(DALISEC_CATALOG.companyCareerPage, 'https://dalisec.com/')
  assert.equal(DALISEC_CATALOG.sitemapUrl, 'https://dalisec.com/sitemap-index.xml')
  assert.deepEqual(DALISEC_CATALOG.checkedCareersRouteUrls, [
    'https://dalisec.com/careers',
    'https://dalisec.com/career',
    'https://dalisec.com/jobs',
    'https://dalisec.com/join-us',
    'https://dalisec.com/openings',
    'https://dalisec.com/current-openings',
    'https://dalisec.com/work-with-us',
  ])
  assert.equal(DALISEC_CATALOG.atsPlatform, 'official-company-site-untrustworthy-edge-error-sentinel')
  assert.equal(DALISEC_CATALOG.countryFilter, 'India')
  assert.equal(DALISEC_CATALOG.paginationStrategy, 'homepage-edge-error-fail-closed-validation')
  assert.equal(DALISEC_CATALOG.extractionStrategy, 'verified-cloudflare-526-edge-error-surface+fail-closed')
  assert.equal(DALISEC_CATALOG.parser, 'custom-script')
  assert.equal(DALISEC_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DALISEC_CATALOG.companyDomain, 'dalisec.com')
  assert.equal(DALISEC_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(DALISEC_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Cloudflare 526 Invalid SSL certificate edge error/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /not trustworthy public surface|no longer exposes a trustworthy public surface/i)
  assert.match(DALISEC_CATALOG.modulePath, /dalisec[\\/]script\.js$/i)
})

test('Dalisec stays registered in the shared provider catalog without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dalisec')

  assert.ok(provider, 'Expected Dalisec provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Dalisec')
  assert.equal(provider.companyCareerPage, 'https://dalisec.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'dalisec.com')
  assert.match(provider.modulePath, /dalisec[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dalisec'), false)
})

test('Dalisec resolves directly from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Dalisec,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dalisec', 'dalisec', 'Dalisec']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'dalisec')

  assert.ok(scraper, 'Expected buildScrapers() to return the Dalisec sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'dalisec')
  assert.equal(scraper.provider.companyCareerPage, 'https://dalisec.com/')
  assert.match(scraper.dryRunFile, /dalisec[\\/]jobs\.json$/i)
})
