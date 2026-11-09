import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fronteggModulePath = path.resolve(currentDir, '../../scraper/frontegg/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/frontegg/catalog.js')
  } catch {
    assert.fail('Expected Frontegg catalog module at ../../scraper/frontegg/catalog.js')
  }
}

const loadFronteggModule = async () => {
  try {
    return await import('../../scraper/frontegg/script.js')
  } catch {
    assert.fail('Expected Frontegg scraper module at ../../scraper/frontegg/script.js')
  }
}

test('Frontegg local catalog captures the verified first-party careers page and current-opening detail route', async () => {
  const { FRONTEGG_CATALOG } = await loadCatalogModule()
  const frontegg = await loadFronteggModule()

  assert.equal(FRONTEGG_CATALOG.source, 'frontegg')
  assert.equal(FRONTEGG_CATALOG.companyName, 'Frontegg')
  assert.equal(FRONTEGG_CATALOG.officialBrandName, 'Frontegg')
  assert.equal(FRONTEGG_CATALOG.adapter, 'script')
  assert.equal(FRONTEGG_CATALOG.homepageUrl, 'https://frontegg.com/')
  assert.equal(FRONTEGG_CATALOG.companyCareerPage, 'https://frontegg.com/careers')
  assert.equal(
    FRONTEGG_CATALOG.verifiedJobDetailUrl,
    'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
  )
  assert.equal(FRONTEGG_CATALOG.companyDomain, 'frontegg.com')
  assert.equal(FRONTEGG_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(FRONTEGG_CATALOG.countryFilter, 'Israel')
  assert.equal(
    FRONTEGG_CATALOG.paginationStrategy,
    'first-party-careers-page-listing-links-plus-first-party-detail-pages',
  )
  assert.equal(
    FRONTEGG_CATALOG.extractionStrategy,
    'verified-careers-page+verified-current-opening-links+verified-detail-page-sections',
  )
  assert.equal(FRONTEGG_CATALOG.parser, 'custom-script')
  assert.equal(FRONTEGG_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FRONTEGG_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(FRONTEGG_CATALOG.dryRunFile, 'frontegg/jobs.json')
  assert.match(FRONTEGG_CATALOG.verifiedSurfaceSummary, /https:\/\/frontegg\.com\//i)
  assert.match(FRONTEGG_CATALOG.verifiedSurfaceSummary, /https:\/\/frontegg\.com\/careers/i)
  assert.match(
    FRONTEGG_CATALOG.verifiedSurfaceSummary,
    /https:\/\/frontegg\.com\/careers\/co\/israel\/DE\.45E\/senior-backend-developer\/all/i,
  )
  assert.match(FRONTEGG_CATALOG.verifiedSurfaceSummary, /Current openings/i)
  assert.match(FRONTEGG_CATALOG.verifiedSurfaceSummary, /Senior Backend Developer/i)
  assert.equal(FRONTEGG_CATALOG.modulePath, fronteggModulePath)

  assert.equal(frontegg.PROVIDER_METADATA.source, FRONTEGG_CATALOG.source)
  assert.equal(frontegg.PROVIDER_METADATA.companyCareerPage, FRONTEGG_CATALOG.companyCareerPage)
  assert.equal(frontegg.PROVIDER_METADATA.verifiedJobDetailUrl, FRONTEGG_CATALOG.verifiedJobDetailUrl)
})
