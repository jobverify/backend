import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aptechModulePath = path.resolve(currentDir, '../../scraper/aptech/script.js')

const loadAptechCatalog = async () => {
  try {
    return await import('../../scraper/aptech/catalog.js')
  } catch {
    assert.fail('Expected Aptech catalog module at ../../scraper/aptech/catalog.js')
  }
}

const loadAptechModule = async () => {
  try {
    return await import('../../scraper/aptech/script.js')
  } catch {
    assert.fail('Expected Aptech scraper module at ../../scraper/aptech/script.js')
  }
}

test('Aptech local catalog captures the verified first-party careers route and API handoff', async () => {
  const { APTECH_CATALOG } = await loadAptechCatalog()
  const aptech = await loadAptechModule()

  assert.equal(APTECH_CATALOG.source, 'aptech')
  assert.equal(APTECH_CATALOG.companyName, 'Aptech')
  assert.equal(APTECH_CATALOG.officialBrandName, 'Aptech Limited')
  assert.equal(APTECH_CATALOG.adapter, 'script')
  assert.equal(APTECH_CATALOG.homepageUrl, 'https://www.aptech-worldwide.com/')
  assert.equal(APTECH_CATALOG.companyCareerPage, 'https://www.aptech-worldwide.com/careers-with-aptech')
  assert.equal(APTECH_CATALOG.careersApiUrl, 'https://api.aptech-worldwide.com/careers/getlist')
  assert.equal(APTECH_CATALOG.sitemapUrl, 'https://www.aptech-worldwide.com/sitemap.xml')
  assert.equal(APTECH_CATALOG.companyDomain, 'aptech-worldwide.com')
  assert.equal(APTECH_CATALOG.atsPlatform, 'first-party-careers-api')
  assert.equal(APTECH_CATALOG.countryFilter, 'India')
  assert.equal(
    APTECH_CATALOG.paginationStrategy,
    'single-first-party-careers-api-feed',
  )
  assert.equal(
    APTECH_CATALOG.extractionStrategy,
    'verified-first-party-careers-route+verified-first-party-bundle-api-handoff+first-party-careers-api',
  )
  assert.equal(APTECH_CATALOG.parser, 'custom-script')
  assert.equal(APTECH_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(APTECH_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(APTECH_CATALOG.dryRunFile, 'aptech/jobs.json')
  assert.match(APTECH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.aptech-worldwide\.com\//i)
  assert.match(APTECH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.aptech-worldwide\.com\/careers-with-aptech/i)
  assert.match(APTECH_CATALOG.verifiedSurfaceSummary, /https:\/\/api\.aptech-worldwide\.com\/careers\/getlist/i)
  assert.equal(APTECH_CATALOG.modulePath, aptechModulePath)

  assert.equal(aptech.PROVIDER_METADATA.source, APTECH_CATALOG.source)
  assert.equal(aptech.PROVIDER_METADATA.companyName, APTECH_CATALOG.companyName)
  assert.equal(aptech.PROVIDER_METADATA.careersApiUrl, APTECH_CATALOG.careersApiUrl)
})

test('Aptech backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { APTECH_CATALOG } = await loadAptechCatalog()
  const provider = hydrateProviderCatalogEntry(APTECH_CATALOG)

  assert.equal(provider.companyName, 'Aptech')
  assert.equal(provider.companyDomain, 'aptech-worldwide.com')
  assert.match(provider.modulePath, /aptech[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /aptech[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aptech'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Aptech\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aptech', 'aptech', 'Aptech']],
  )
})

test('buildScrapers and company coverage resolve Aptech from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aptech')
  const scraper = buildScrapers().find((item) => item.name === 'aptech')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aptech')
  assert.equal(provider.companyCareerPage, 'https://www.aptech-worldwide.com/careers-with-aptech')
  assert.match(scraper.dryRunFile, /aptech[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aptech\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aptech', 'aptech', 'Aptech']],
  )
})
