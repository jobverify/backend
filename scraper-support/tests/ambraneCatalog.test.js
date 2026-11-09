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
const ambraneModulePath = path.resolve(currentDir, '../../scraper/ambrane/script.js')

const loadAmbraneCatalog = async () => {
  try {
    return await import('../../scraper/ambrane/catalog.js')
  } catch {
    assert.fail('Expected Ambrane catalog module at ../../scraper/ambrane/catalog.js')
  }
}

const loadAmbraneModule = async () => {
  try {
    return await import('../../scraper/ambrane/script.js')
  } catch {
    assert.fail('Expected Ambrane scraper module at ../../scraper/ambrane/script.js')
  }
}

test('Ambrane local catalog captures the verified first-party empty career shell and checked 404 routes', async () => {
  const { AMBRANE_CATALOG } = await loadAmbraneCatalog()
  const ambrane = await loadAmbraneModule()

  assert.equal(AMBRANE_CATALOG.source, 'ambrane')
  assert.equal(AMBRANE_CATALOG.companyName, 'Ambrane')
  assert.equal(AMBRANE_CATALOG.officialBrandName, 'Ambrane')
  assert.equal(AMBRANE_CATALOG.adapter, 'script')
  assert.equal(AMBRANE_CATALOG.homepageUrl, 'https://ambraneindia.com/')
  assert.equal(AMBRANE_CATALOG.companyCareerPage, 'https://ambraneindia.com/pages/career')
  assert.equal(AMBRANE_CATALOG.careerPageUrl, 'https://ambraneindia.com/pages/career')
  assert.equal(AMBRANE_CATALOG.sitemapUrl, 'https://ambraneindia.com/sitemap.xml')
  assert.deepEqual(AMBRANE_CATALOG.checkedMissingRouteUrls, [
    'https://ambraneindia.com/careers',
    'https://ambraneindia.com/career',
    'https://ambraneindia.com/jobs',
    'https://ambraneindia.com/join-us',
    'https://ambraneindia.com/openings',
    'https://ambraneindia.com/pages/careers',
    'https://ambraneindia.com/pages/jobs',
    'https://ambraneindia.com/pages/join-us',
  ])
  assert.equal(AMBRANE_CATALOG.companyDomain, 'ambraneindia.com')
  assert.equal(AMBRANE_CATALOG.atsPlatform, 'official-company-careers-empty-shell')
  assert.equal(AMBRANE_CATALOG.countryFilter, 'India')
  assert.equal(
    AMBRANE_CATALOG.paginationStrategy,
    'homepage-plus-empty-career-shell-plus-common-route-404-validation',
  )
  assert.equal(
    AMBRANE_CATALOG.extractionStrategy,
    'verified-homepage+verified-empty-career-shell+verified-missing-common-routes-return-empty',
  )
  assert.equal(AMBRANE_CATALOG.parser, 'custom-script')
  assert.equal(AMBRANE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AMBRANE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AMBRANE_CATALOG.dryRunFile, 'ambrane/jobs.json')
  assert.match(AMBRANE_CATALOG.verifiedSurfaceSummary, /https:\/\/ambraneindia\.com\//i)
  assert.match(AMBRANE_CATALOG.verifiedSurfaceSummary, /https:\/\/ambraneindia\.com\/pages\/career/i)
  assert.match(AMBRANE_CATALOG.verifiedSurfaceSummary, /https:\/\/ambraneindia\.com\/careers/i)
  assert.match(AMBRANE_CATALOG.verifiedSurfaceSummary, /https:\/\/ambraneindia\.com\/sitemap\.xml/i)
  assert.match(AMBRANE_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(AMBRANE_CATALOG.modulePath, ambraneModulePath)

  assert.equal(ambrane.PROVIDER_METADATA.source, AMBRANE_CATALOG.source)
  assert.equal(ambrane.PROVIDER_METADATA.companyName, AMBRANE_CATALOG.companyName)
  assert.equal(ambrane.PROVIDER_METADATA.careerPageUrl, AMBRANE_CATALOG.careerPageUrl)
  assert.equal(
    ambrane.PROVIDER_METADATA.checkedMissingRouteUrls.length,
    AMBRANE_CATALOG.checkedMissingRouteUrls.length,
  )
})

test('Ambrane backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { AMBRANE_CATALOG } = await loadAmbraneCatalog()
  const provider = hydrateProviderCatalogEntry(AMBRANE_CATALOG)

  assert.equal(provider.companyName, 'Ambrane')
  assert.equal(provider.companyDomain, 'ambraneindia.com')
  assert.match(provider.modulePath, /ambrane[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ambrane[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ambrane'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Ambrane\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ambrane', 'ambrane', 'Ambrane']],
  )
})

test('buildScrapers and company coverage resolve Ambrane from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ambrane')
  const scraper = buildScrapers().find((item) => item.name === 'ambrane')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Ambrane')
  assert.equal(provider.companyCareerPage, 'https://ambraneindia.com/pages/career')
  assert.match(scraper.dryRunFile, /ambrane[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Ambrane\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ambrane', 'ambrane', 'Ambrane']],
  )
})
