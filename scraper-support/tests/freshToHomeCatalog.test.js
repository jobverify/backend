import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import FRESHTOHOME_CATALOG, {
  FRESHTOHOME_CATALOG as namedCatalog,
  VERIFIED_SURFACE_SUMMARY,
} from '../../scraper/freshtohome/catalog.js'
import { PROVIDER_METADATA } from '../../scraper/freshtohome/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/freshtohome/script.js')

test('FreshToHome catalog captures the verified homepage, crawl surfaces, and no-public-jobs sentinel state', () => {
  assert.equal(FRESHTOHOME_CATALOG, namedCatalog)
  assert.equal(namedCatalog.source, 'freshtohome')
  assert.equal(namedCatalog.companyName, 'FreshToHome')
  assert.equal(namedCatalog.officialBrandName, 'FreshToHome')
  assert.equal(namedCatalog.adapter, 'script')
  assert.equal(namedCatalog.homepageUrl, 'https://www.freshtohome.com/')
  assert.equal(namedCatalog.companyCareerPage, 'https://www.freshtohome.com/')
  assert.equal(namedCatalog.robotsTxtUrl, 'https://www.freshtohome.com/robots.txt')
  assert.equal(namedCatalog.sitemapUrl, 'https://www.freshtohome.com/sitemap/sitemap.xml')
  assert.deepEqual(namedCatalog.checkedMissingRouteUrls, [
    'https://www.freshtohome.com/careers',
    'https://www.freshtohome.com/career',
    'https://www.freshtohome.com/jobs',
    'https://www.freshtohome.com/join-us',
    'https://www.freshtohome.com/work-with-us',
    'https://www.freshtohome.com/openings',
    'https://www.freshtohome.com/current-openings',
  ])
  assert.equal(namedCatalog.companyDomain, 'freshtohome.com')
  assert.equal(namedCatalog.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(namedCatalog.countryFilter, 'India')
  assert.equal(
    namedCatalog.paginationStrategy,
    'verified-homepage-plus-robots-and-sitemap-plus-common-careers-route-404-validation',
  )
  assert.equal(
    namedCatalog.extractionStrategy,
    'verified-homepage+verified-robots-and-sitemap-without-careers-url+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(namedCatalog.parser, 'custom-script')
  assert.equal(namedCatalog.normalizationProfile, 'engineering-default')
  assert.equal(namedCatalog.verifiedOn, '2026-09-03')
  assert.equal(namedCatalog.dryRunFile, 'freshtohome/jobs.json')
  assert.equal(namedCatalog.modulePath, modulePath)
  assert.equal(PROVIDER_METADATA.source, namedCatalog.source)
  assert.equal(PROVIDER_METADATA.companyName, namedCatalog.companyName)
  assert.equal(VERIFIED_SURFACE_SUMMARY, namedCatalog.verifiedSurfaceSummary)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.freshtohome\.com\//i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.freshtohome\.com\/robots\.txt/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.freshtohome\.com\/sitemap\/sitemap\.xml/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.freshtohome\.com\/careers/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /404/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})
