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
const otipyModulePath = path.resolve(currentDir, '../../scraper/otipy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/otipy/catalog.js')
  } catch {
    assert.fail('Expected Otipy catalog module at ../../scraper/otipy/catalog.js')
  }
}

test('Otipy local catalog captures the verified blocked first-party public-surface state', async () => {
  const {
    OTIPY_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OTIPY_CATALOG)

  assert.equal(defaultCatalog, OTIPY_CATALOG)
  assert.equal(provider.source, 'otipy')
  assert.equal(provider.companyName, 'Otipy')
  assert.equal(provider.officialBrandName, 'Otipy')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://otipy.com/')
  assert.equal(provider.companyCareerPage, 'https://otipy.com/careers')
  assert.equal(provider.companyDomain, 'otipy.com')
  assert.equal(provider.officialJobsPageUrl, 'https://otipy.com/jobs')
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-and-careers-route-blocked-surface-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-tls-mismatch+verified-careers-tls-mismatch+verified-jobs-tls-mismatch-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/otipy\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/otipy\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /ERR_TLS_CERT_ALTNAME_INVALID/i)
  assert.match(provider.verifiedSurfaceSummary, /gps\.vendors\.intusystems\.info/i)
  assert.equal(provider.modulePath, otipyModulePath)
  assert.match(provider.dryRunFile, /otipy[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Otipy'), false)
})

test('Otipy backlog row matches directly from the local catalog metadata', async () => {
  const { OTIPY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Otipy\n',
    catalog: [OTIPY_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Otipy', 'otipy', 'Otipy']],
  )
})

test('getScraperCatalog exposes Otipy as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'otipy')
  const scraper = buildScrapers().find((item) => item.name === 'otipy')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Otipy')
  assert.equal(provider.companyCareerPage, 'https://otipy.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Otipy'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Otipy\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Otipy', 'otipy', 'Otipy']],
  )
})
