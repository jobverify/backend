import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const havasIndiaModulePath = path.resolve(currentDir, '../../scraper/havasindia.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/havasindia.workday/catalog.js')
  } catch {
    assert.fail('Expected Havas India catalog module at ../../scraper/havasindia.workday/catalog.js')
  }
}

test('Havas India local catalog captures the verified first-party careers handoff and public Workday metadata', async () => {
  const {
    HAVAS_INDIA_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, HAVAS_INDIA_CATALOG)
  assert.equal(HAVAS_INDIA_CATALOG.source, 'havasindia')
  assert.equal(HAVAS_INDIA_CATALOG.companyName, 'Havas India')
  assert.equal(HAVAS_INDIA_CATALOG.officialBrandName, 'Havas')
  assert.equal(HAVAS_INDIA_CATALOG.adapter, 'script')
  assert.equal(HAVAS_INDIA_CATALOG.modulePath, havasIndiaModulePath)
  assert.equal(HAVAS_INDIA_CATALOG.dryRunFile, 'havasindia.workday/jobs.json')
  assert.equal(HAVAS_INDIA_CATALOG.officialHomepageUrl, 'https://in.havas.com/')
  assert.equal(HAVAS_INDIA_CATALOG.companyCareerPage, 'https://in.havas.com/careers/')
  assert.equal(HAVAS_INDIA_CATALOG.companyDomain, 'havas.com')
  assert.equal(
    HAVAS_INDIA_CATALOG.officialWorkdayBoardUrl,
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite',
  )
  assert.equal(
    HAVAS_INDIA_CATALOG.jobsApiUrl,
    'https://wd3.myworkdaysite.com/wday/cxs/havas/GroupExternalCareerSite/jobs',
  )
  assert.equal(
    HAVAS_INDIA_CATALOG.verifiedIndiaCountryFacetId,
    'c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(
    HAVAS_INDIA_CATALOG.verifiedIndiaJobUrl,
    'https://wd3.myworkdaysite.com/recruiting/havas/GroupExternalCareerSite/job/Chennai/Digital-Developer_JR0097642-1',
  )
  assert.equal(HAVAS_INDIA_CATALOG.atsPlatform, 'workday')
  assert.equal(HAVAS_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    HAVAS_INDIA_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-direct-workday-country-facet-api',
  )
  assert.equal(
    HAVAS_INDIA_CATALOG.extractionStrategy,
    'verified-careers-page+verified-workday-board+direct-unfiltered-workday-jobs-api+india-country-facet+direct-filtered-workday-jobs-api',
  )
  assert.equal(HAVAS_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(HAVAS_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HAVAS_INDIA_CATALOG.verifiedOn, '2026-08-08')
  assert.equal(HAVAS_INDIA_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/in\.havas\.com\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/rb\.gy\/5daebl/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/wd3\.myworkdaysite\.com\/recruiting\/havas\/GroupExternalCareerSite/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/wd3\.myworkdaysite\.com\/wday\/cxs\/havas\/GroupExternalCareerSite\/jobs/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b51 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\bAugust 8, 2026\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\bdirect POST\b/i)
})

test('Havas India local catalog hydrates into coverage without needing an alias entry', async () => {
  const { HAVAS_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HAVAS_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Havas India')
  assert.equal(provider.companyDomain, 'havas.com')
  assert.match(provider.modulePath, /havasindia\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /havasindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Havas India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Havas India', 'havasindia', 'Havas India']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Havas India'), false)
})

test('getScraperCatalog includes Havas India as a verified Workday provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'havasindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Havas India')
  assert.equal(provider.companyCareerPage, 'https://in.havas.com/careers/')
  assert.equal(provider.companyDomain, 'havas.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /havasindia\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Havas India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'havasindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'havasindia')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /havasindia.workday[\\/]jobs\.json$/i)
})
