import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/revolut/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/revolut/catalog.js')
  } catch {
    assert.fail('Expected Revolut catalog module at ../../scraper/revolut/catalog.js')
  }
}

test('Revolut local catalog captures the verified exact-name first-party careers page and India job payload metadata', async () => {
  const {
    REVOLUT_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, REVOLUT_CATALOG)
  assert.equal(REVOLUT_CATALOG.source, 'revolut')
  assert.equal(REVOLUT_CATALOG.companyName, 'Revolut')
  assert.equal(REVOLUT_CATALOG.officialBrandName, 'Revolut')
  assert.equal(REVOLUT_CATALOG.adapter, 'script')
  assert.equal(REVOLUT_CATALOG.modulePath, modulePath)
  assert.equal(REVOLUT_CATALOG.dryRunFile, 'revolut/jobs.json')
  assert.equal(REVOLUT_CATALOG.officialHomepageUrl, 'https://www.revolut.com/')
  assert.equal(REVOLUT_CATALOG.companyCareerPage, 'https://www.revolut.com/en-IN/careers/')
  assert.equal(REVOLUT_CATALOG.officialCareersGlobalUrl, 'https://www.revolut.com/en-US/careers/')
  assert.equal(REVOLUT_CATALOG.companyDomain, 'revolut.com')
  assert.equal(REVOLUT_CATALOG.positionsDataSource, 'window.__NEXT_DATA__.props.pageProps.positions')
  assert.equal(REVOLUT_CATALOG.verifiedPublicRoleCount, 610)
  assert.equal(REVOLUT_CATALOG.verifiedIndiaRoleCount, 47)
  assert.equal(
    REVOLUT_CATALOG.verifiedSampleIndiaJobUrl,
    'https://www.revolut.com/en-US/careers/position/666ce819-a63a-4642-98c8-66c88af9c63a/',
  )
  assert.equal(REVOLUT_CATALOG.atsPlatform, 'official-first-party-nextjs-careers')
  assert.equal(REVOLUT_CATALOG.countryFilter, 'India')
  assert.equal(REVOLUT_CATALOG.paginationStrategy, 'browser-loaded-nextjs-payload-single-page')
  assert.equal(
    REVOLUT_CATALOG.extractionStrategy,
    'verified-en-IN-careers-page+verified-nextjs-positions-payload+india-country-filter+verified-detail-url-pattern',
  )
  assert.equal(REVOLUT_CATALOG.parser, 'custom-script')
  assert.equal(REVOLUT_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(REVOLUT_CATALOG.verifiedOn, '2026-07-17')
  assert.equal(REVOLUT_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Friday, July 17, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.revolut\.com\/en-IN\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /window\.__NEXT_DATA__\.props\.pageProps\.positions/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b610 public roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b47 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /666ce819-a63a-4642-98c8-66c88af9c63a/i)
})
