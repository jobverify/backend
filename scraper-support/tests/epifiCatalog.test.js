import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const epifiModulePath = path.resolve(currentDir, '../../scraper/epifi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/epifi/catalog.js')
  } catch {
    assert.fail('Expected Epifi catalog module at ../../scraper/epifi/catalog.js')
  }
}

test('Epifi catalog captures the verified first-party Fi Money handoff and public Lever metadata', async () => {
  const {
    EPIFI_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(EPIFI_CATALOG.source, 'epifi')
  assert.equal(EPIFI_CATALOG.companyName, 'Epifi')
  assert.equal(EPIFI_CATALOG.officialBrandName, 'Fi Money')
  assert.equal(EPIFI_CATALOG.adapter, 'script')
  assert.equal(EPIFI_CATALOG.modulePath, epifiModulePath)
  assert.equal(EPIFI_CATALOG.dryRunFile, 'epifi/jobs.json')
  assert.equal(EPIFI_CATALOG.officialHomepageUrl, 'https://epifi.com/')
  assert.equal(EPIFI_CATALOG.resolvedHomepageUrl, 'https://fi.money/')
  assert.equal(EPIFI_CATALOG.companyCareerPage, 'https://fi.money/careers')
  assert.equal(EPIFI_CATALOG.companyDomain, 'fi.money')
  assert.equal(EPIFI_CATALOG.officialLeverBoardUrl, 'https://jobs.lever.co/epifi')
  assert.equal(EPIFI_CATALOG.leverApiUrl, 'https://api.lever.co/v0/postings/epifi?mode=json')
  assert.equal(EPIFI_CATALOG.verifiedIndiaCountryCode, 'IN')
  assert.equal(EPIFI_CATALOG.verifiedLeverPostingCount, 6)
  assert.equal(EPIFI_CATALOG.verifiedIndiaRoleCount, 6)
  assert.equal(EPIFI_CATALOG.verifiedLeverLocation, 'Bangalore')
  assert.equal(
    EPIFI_CATALOG.verifiedSampleJobUrl,
    'https://jobs.lever.co/epifi/08c743e8-2b29-4f78-827e-5bd90476ed86',
  )
  assert.equal(EPIFI_CATALOG.atsPlatform, 'lever')
  assert.equal(EPIFI_CATALOG.countryFilter, 'India')
  assert.equal(
    EPIFI_CATALOG.paginationStrategy,
    'verified-homepage-redirect-plus-careers-validation-plus-lever-api',
  )
  assert.equal(
    EPIFI_CATALOG.extractionStrategy,
    'verified-homepage-redirect+verified-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  )
  assert.equal(EPIFI_CATALOG.parser, 'custom-script')
  assert.equal(EPIFI_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EPIFI_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(EPIFI_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/epifi\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fi\.money\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fi\.money\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.lever\.co\/epifi/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api\.lever\.co\/v0\/postings\/epifi\?mode=json/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jobs\.lever\.co\/epifi\/08c743e8-2b29-4f78-827e-5bd90476ed86/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b6 public postings\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b6 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\bBangalore\b/i)
})
