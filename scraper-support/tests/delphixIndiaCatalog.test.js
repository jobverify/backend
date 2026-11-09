import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const delphixIndiaModulePath = path.resolve(currentDir, '../../scraper/delphixindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/delphixindia/catalog.js')
  } catch {
    assert.fail('Expected Delphix India catalog module at ../../scraper/delphixindia/catalog.js')
  }
}

test('Delphix India local catalog captures the verified Delphix-to-Perforce careers handoff and public Lever metadata', async () => {
  const {
    DELPHIX_INDIA_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(DELPHIX_INDIA_CATALOG.source, 'delphixindia')
  assert.equal(DELPHIX_INDIA_CATALOG.companyName, 'Delphix India')
  assert.equal(DELPHIX_INDIA_CATALOG.officialBrandName, 'Delphix')
  assert.equal(DELPHIX_INDIA_CATALOG.adapter, 'script')
  assert.equal(DELPHIX_INDIA_CATALOG.modulePath, delphixIndiaModulePath)
  assert.equal(DELPHIX_INDIA_CATALOG.dryRunFile, 'delphixindia/jobs.json')
  assert.equal(DELPHIX_INDIA_CATALOG.officialHomepageUrl, 'https://www.delphix.com/')
  assert.equal(
    DELPHIX_INDIA_CATALOG.resolvedHomepageUrl,
    'https://www.perforce.com/products/delphix',
  )
  assert.equal(DELPHIX_INDIA_CATALOG.companyCareerPage, 'https://www.perforce.com/careers')
  assert.equal(DELPHIX_INDIA_CATALOG.companyDomain, 'delphix.com')
  assert.equal(DELPHIX_INDIA_CATALOG.officialLeverBoardUrl, 'https://jobs.lever.co/perforce')
  assert.equal(
    DELPHIX_INDIA_CATALOG.leverApiUrl,
    'https://api.lever.co/v0/postings/perforce?mode=json',
  )
  assert.equal(DELPHIX_INDIA_CATALOG.brandKeyword, 'Delphix')
  assert.equal(DELPHIX_INDIA_CATALOG.verifiedIndiaLocationName, 'Pune, Maharashtra')
  assert.equal(DELPHIX_INDIA_CATALOG.atsPlatform, 'lever')
  assert.equal(DELPHIX_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    DELPHIX_INDIA_CATALOG.paginationStrategy,
    'official-homepage-redirect-plus-careers-validation-plus-lever-api',
  )
  assert.equal(
    DELPHIX_INDIA_CATALOG.extractionStrategy,
    'verified-delphix-homepage-redirect+verified-perforce-careers-page+verified-lever-board+lever-postings-api+board-api-zero-check+delphix-brand-filter+india-location-filter',
  )
  assert.equal(DELPHIX_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(DELPHIX_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DELPHIX_INDIA_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(DELPHIX_INDIA_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.delphix\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.perforce\.com\/products\/delphix/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.perforce\.com\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.lever\.co\/perforce/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/api\.lever\.co\/v0\/postings\/perforce\?mode=json/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b0 Delphix India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Pune, Maharashtra/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no role is Delphix-branded/i)
})

test('Delphix India local catalog hydrates into coverage without needing an alias entry', async () => {
  const { DELPHIX_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DELPHIX_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Delphix India')
  assert.equal(provider.companyDomain, 'delphix.com')
  assert.match(provider.modulePath, /delphixindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /delphixindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Delphix India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Delphix India', 'delphixindia', 'Delphix India']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Delphix India'), false)
})

test('buildScrapers and company coverage resolve Delphix India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'delphixindia')
  const scraper = buildScrapers().find((item) => item.name === 'delphixindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Delphix India')
  assert.equal(provider.companyCareerPage, 'https://www.perforce.com/careers')
  assert.match(scraper.dryRunFile, /delphixindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Delphix India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Delphix India', 'delphixindia', 'Delphix India']],
  )
})
