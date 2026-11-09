import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import FYLE_CATALOG, {
  FYLE_CATALOG as namedCatalog,
  VERIFIED_SURFACE_SUMMARY,
} from '../../scraper/fyle/catalog.js'
import { PROVIDER_METADATA } from '../../scraper/fyle/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fyle/script.js')

test('Fyle catalog captures the verified careers redirect shell, crawl surfaces, and no-public-jobs sentinel state', () => {
  assert.equal(FYLE_CATALOG, namedCatalog)
  assert.equal(namedCatalog.source, 'fyle')
  assert.equal(namedCatalog.companyName, 'Fyle')
  assert.equal(namedCatalog.officialBrandName, 'Sage Expense Management (formerly Fyle)')
  assert.equal(namedCatalog.adapter, 'script')
  assert.equal(namedCatalog.homepageUrl, 'https://www.fylehq.com/')
  assert.equal(namedCatalog.companyCareerPage, 'https://www.fylehq.com/careers')
  assert.equal(namedCatalog.resolvedCareerPageUrl, 'https://www.fylehq.com/company/team/join')
  assert.equal(namedCatalog.robotsTxtUrl, 'https://www.fylehq.com/robots.txt')
  assert.equal(namedCatalog.sitemapUrl, 'https://www.fylehq.com/sitemap.xml')
  assert.deepEqual(namedCatalog.checkedMissingRouteUrls, [
    'https://www.fylehq.com/career',
    'https://www.fylehq.com/jobs',
    'https://www.fylehq.com/join-us',
    'https://www.fylehq.com/about/careers',
    'https://www.fylehq.com/company/careers',
    'https://www.fylehq.com/openings',
    'https://www.fylehq.com/work-with-us',
    'https://www.fylehq.com/current-openings',
  ])
  assert.equal(namedCatalog.companyDomain, 'fylehq.com')
  assert.equal(namedCatalog.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(namedCatalog.countryFilter, 'India')
  assert.equal(
    namedCatalog.paginationStrategy,
    'verified-homepage-plus-careers-redirect-shell-plus-robots-sitemap-and-404-route-validation',
  )
  assert.equal(
    namedCatalog.extractionStrategy,
    'verified-homepage+verified-careers-redirect-shell-without-public-listings+verified-sitemap-single-careers-shell+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(namedCatalog.parser, 'custom-script')
  assert.equal(namedCatalog.normalizationProfile, 'engineering-default')
  assert.equal(namedCatalog.verifiedOn, '2026-09-03')
  assert.equal(namedCatalog.dryRunFile, 'fyle/jobs.json')
  assert.equal(namedCatalog.modulePath, modulePath)
  assert.equal(PROVIDER_METADATA.source, namedCatalog.source)
  assert.equal(PROVIDER_METADATA.companyName, namedCatalog.companyName)
  assert.equal(VERIFIED_SURFACE_SUMMARY, namedCatalog.verifiedSurfaceSummary)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.fylehq\.com\//i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.fylehq\.com\/careers/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.fylehq\.com\/company\/team\/join/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.fylehq\.com\/robots\.txt/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.fylehq\.com\/sitemap\.xml/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})
