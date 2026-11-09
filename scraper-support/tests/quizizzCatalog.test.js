import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const quizizzModulePath = path.resolve(currentDir, '../../scraper/quizizz/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/quizizz/catalog.js')
  } catch {
    assert.fail('Expected Quizizz catalog module at ../../scraper/quizizz/catalog.js')
  }
}

test('Quizizz local catalog captures the verified exact-name careers redirect and Wayground Lever board metadata', async () => {
  const { QUIZIZZ_CATALOG, VERIFIED_SURFACE_SUMMARY } = await loadCatalogModule()

  assert.equal(QUIZIZZ_CATALOG.source, 'quizizz')
  assert.equal(QUIZIZZ_CATALOG.companyName, 'Quizizz')
  assert.equal(QUIZIZZ_CATALOG.officialBrandName, 'Wayground (formerly Quizizz)')
  assert.equal(QUIZIZZ_CATALOG.adapter, 'script')
  assert.equal(QUIZIZZ_CATALOG.modulePath, quizizzModulePath)
  assert.equal(QUIZIZZ_CATALOG.dryRunFile, 'quizizz/jobs.json')
  assert.equal(QUIZIZZ_CATALOG.officialHomepageUrl, 'https://quizizz.com/')
  assert.equal(QUIZIZZ_CATALOG.companyCareerPage, 'https://quizizz.com/home/careers?lng=en')
  assert.equal(QUIZIZZ_CATALOG.resolvedCareerPageUrl, 'https://wayground.com/home/careers?lng=en')
  assert.equal(QUIZIZZ_CATALOG.companyDomain, 'quizizz.com')
  assert.equal(QUIZIZZ_CATALOG.officialLeverBoardUrl, 'https://jobs.lever.co/Wayground')
  assert.equal(
    QUIZIZZ_CATALOG.leverApiUrl,
    'https://api.lever.co/v0/postings/Wayground?mode=json',
  )
  assert.equal(QUIZIZZ_CATALOG.verifiedIndiaCountryCode, 'IN')
  assert.equal(QUIZIZZ_CATALOG.verifiedLeverPostingCount, 4)
  assert.equal(QUIZIZZ_CATALOG.verifiedIndiaRoleCount, 4)
  assert.equal(
    QUIZIZZ_CATALOG.verifiedSampleIndiaJobUrl,
    'https://jobs.lever.co/Wayground/1f96f79c-0168-4a33-b0ae-f8fb649e69f2',
  )
  assert.equal(QUIZIZZ_CATALOG.atsPlatform, 'lever')
  assert.equal(QUIZIZZ_CATALOG.countryFilter, 'India')
  assert.equal(
    QUIZIZZ_CATALOG.paginationStrategy,
    'exact-name-careers-redirect-plus-lever-api',
  )
  assert.equal(
    QUIZIZZ_CATALOG.extractionStrategy,
    'verified-exact-name-careers-url+verified-wayground-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  )
  assert.equal(QUIZIZZ_CATALOG.parser, 'custom-script')
  assert.equal(QUIZIZZ_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(QUIZIZZ_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(QUIZIZZ_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/quizizz\.com\/home\/careers\?lng=en/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/wayground\.com\/home\/careers\?lng=en/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.lever\.co\/Wayground/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api\.lever\.co\/v0\/postings\/Wayground\?mode=json/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b4 public postings\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b4 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Quizizz Inc\. \(DBA Wayground\)/i)
})
