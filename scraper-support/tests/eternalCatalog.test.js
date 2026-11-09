import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const eternalModulePath = path.resolve(currentDir, '../../scraper/eternal/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eternal/catalog.js')
  } catch {
    assert.fail('Expected Eternal catalog module at ../../scraper/eternal/catalog.js')
  }
}

test('Eternal catalog captures the verified first-party no-public-jobs contract', async () => {
  const {
    ETERNAL_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(ETERNAL_CATALOG.source, 'eternal')
  assert.equal(ETERNAL_CATALOG.companyName, 'Eternal')
  assert.equal(ETERNAL_CATALOG.officialBrandName, 'Eternal')
  assert.equal(ETERNAL_CATALOG.adapter, 'script')
  assert.equal(ETERNAL_CATALOG.modulePath, eternalModulePath)
  assert.equal(ETERNAL_CATALOG.dryRunFile, 'eternal/jobs.json')
  assert.equal(ETERNAL_CATALOG.homepageUrl, 'https://www.eternal.com/')
  assert.equal(ETERNAL_CATALOG.companyCareerPage, 'https://www.eternal.com/careers/')
  assert.equal(ETERNAL_CATALOG.canonicalCareerUrl, 'https://eternal.com/careers')
  assert.equal(ETERNAL_CATALOG.companyDomain, 'eternal.com')
  assert.deepEqual(ETERNAL_CATALOG.checkedNoJobsRouteUrls, [
    'https://www.eternal.com/jobs/',
    'https://www.eternal.com/join-us/',
    'https://www.eternal.com/work-with-us/',
  ])
  assert.equal(ETERNAL_CATALOG.robotsTxtUrl, 'https://www.eternal.com/robots.txt')
  assert.equal(ETERNAL_CATALOG.sitemapUrl, 'https://www.eternal.com/sitemap.xml')
  assert.equal(ETERNAL_CATALOG.notFoundPageTitle, 'Page Not Found | Eternal')
  assert.equal(ETERNAL_CATALOG.atsPlatform, 'official-company-site-no-public-jobs')
  assert.equal(ETERNAL_CATALOG.countryFilter, 'India')
  assert.equal(
    ETERNAL_CATALOG.paginationStrategy,
    'verified-homepage-plus-careers-shell-plus-missing-robots-sitemap-plus-not-found-job-routes',
  )
  assert.equal(
    ETERNAL_CATALOG.extractionStrategy,
    'verified-homepage-careers-link+verified-careers-shell-without-public-jobs+verified-missing-robots-sitemap+verified-not-found-job-routes+return-empty',
  )
  assert.equal(ETERNAL_CATALOG.parser, 'custom-script')
  assert.equal(ETERNAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ETERNAL_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ETERNAL_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.eternal\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.eternal\.com\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.eternal\.com\/robots\.txt/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.eternal\.com\/sitemap\.xml/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.eternal\.com\/jobs\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Careers - Hiring at Eternal/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Page Not Found \| Eternal/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})
