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
const modulePath = path.resolve(currentDir, '../../scraper/digiversal/script.js')

const loadDigiVersalCatalog = async () => {
  try {
    return await import('../../scraper/digiversal/catalog.js')
  } catch {
    assert.fail('Expected DigiVersal catalog module at ../../scraper/digiversal/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  dryRunFile: catalogEntry.dryRunFile ?? 'digiversal/jobs.json',
  modulePath,
})

test('DigiVersal catalog captures the verified first-party careers surface metadata', async () => {
  const {
    DIGIVERSAL_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
    default: defaultCatalog,
  } = await loadDigiVersalCatalog()
  const provider = buildCatalogReadyProvider(DIGIVERSAL_CATALOG)

  assert.equal(defaultCatalog, DIGIVERSAL_CATALOG)
  assert.equal(provider.source, 'digiversal')
  assert.equal(provider.companyName, 'DigiVersal')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /digiversal[\\/]jobs\.json$/i)
  assert.equal(provider.rootUrl, 'https://digiversal.in/')
  assert.equal(provider.homepageUrl, 'https://www.digiversal.co/')
  assert.equal(provider.companyCareerPage, 'https://www.digiversal.co/careers/')
  assert.equal(provider.companyDomain, 'digiversal.co')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-same-domain-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-in-root-redirect+verified-homepage-careers-link+verified-careers-listing-cards+same-domain-detail-pages+verified-missing-alternate-job-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/digiversal\.in\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/sitemap\.xml\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/careers\/academic-research-mentor\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/careers\/digital-marketing-executive\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/careers\/android-developer\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /22 same-domain role cards/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/jobs\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.digiversal\.co\/career\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DigiVersal'), false)
})

test('DigiVersal backlog matching works directly from the local catalog metadata', async () => {
  const { DIGIVERSAL_CATALOG } = await loadDigiVersalCatalog()
  const provider = buildCatalogReadyProvider(DIGIVERSAL_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'DigiVersal\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DigiVersal', 'digiversal', 'DigiVersal']],
  )
})

test('buildScrapers and company coverage resolve DigiVersal from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'digiversal')
  const scraper = buildScrapers().find((item) => item.name === 'digiversal')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'DigiVersal')
  assert.equal(provider.companyCareerPage, 'https://www.digiversal.co/careers/')
  assert.match(scraper.dryRunFile, /digiversal[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'DigiVersal\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DigiVersal', 'digiversal', 'DigiVersal']],
  )
})
