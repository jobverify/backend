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
const avantelModulePath = path.resolve(currentDir, '../../scraper/avantel/script.js')

const VERIFIED_ROLE_TITLES = [
  'Embedded Senior Engineer',
  'Design Engineer - Parabolic & Earth Station Antennas',
  'PCB Designer Engineer',
  'Quality Management System',
  'RF Manager / Senior Manager',
  'Project Manager',
  'Senior Manager / DGM - Quality',
]

const loadAvantelCatalog = async () => {
  try {
    return await import('../../scraper/avantel/catalog.js')
  } catch {
    assert.fail('Expected Avantel catalog module at ../../scraper/avantel/catalog.js')
  }
}

const loadAvantelModule = async () => {
  try {
    return await import('../../scraper/avantel/script.js')
  } catch {
    assert.fail('Expected Avantel scraper module at ../../scraper/avantel/script.js')
  }
}

test('Avantel local catalog captures the verified first-party careers SPA surface and embedded bundle jobs', async () => {
  const { AVANTEL_CATALOG } = await loadAvantelCatalog()
  const avantel = await loadAvantelModule()

  assert.equal(AVANTEL_CATALOG.source, 'avantel')
  assert.equal(AVANTEL_CATALOG.companyName, 'Avantel')
  assert.equal(AVANTEL_CATALOG.officialBrandName, 'Avantel Limited')
  assert.equal(AVANTEL_CATALOG.adapter, 'script')
  assert.equal(AVANTEL_CATALOG.homepageUrl, 'https://www.avantel.in/')
  assert.equal(AVANTEL_CATALOG.companyCareerPage, 'https://www.avantel.in/careers')
  assert.equal(AVANTEL_CATALOG.jobDescriptionRouteUrl, 'https://www.avantel.in/jobdescription')
  assert.equal(AVANTEL_CATALOG.bundleUrl, 'https://www.avantel.in/static/js/main.bc2d10f8.js')
  assert.deepEqual(AVANTEL_CATALOG.verifiedRoleTitles, VERIFIED_ROLE_TITLES)
  assert.equal(AVANTEL_CATALOG.companyDomain, 'avantel.in')
  assert.equal(AVANTEL_CATALOG.atsPlatform, 'official-company-careers-spa-bundle')
  assert.equal(AVANTEL_CATALOG.countryFilter, 'India')
  assert.equal(
    AVANTEL_CATALOG.paginationStrategy,
    'single-first-party-spa-bundle-embedded-job-array',
  )
  assert.equal(
    AVANTEL_CATALOG.extractionStrategy,
    'verified-homepage-shell+verified-careers-shell+verified-main-bundle+embedded-jobListings-array+first-party-jobdescription-route',
  )
  assert.equal(AVANTEL_CATALOG.parser, 'custom-script')
  assert.equal(AVANTEL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AVANTEL_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AVANTEL_CATALOG.dryRunFile, 'avantel/jobs.json')
  assert.match(AVANTEL_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.avantel\.in\//i)
  assert.match(AVANTEL_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.avantel\.in\/careers/i)
  assert.match(
    AVANTEL_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.avantel\.in\/static\/js\/main\.bc2d10f8\.js/i,
  )
  assert.match(AVANTEL_CATALOG.verifiedSurfaceSummary, /7 public openings/i)
  assert.match(AVANTEL_CATALOG.verifiedSurfaceSummary, /Embedded Senior Engineer/i)
  assert.match(AVANTEL_CATALOG.verifiedSurfaceSummary, /Senior Manager \/ DGM - Quality/i)
  assert.equal(AVANTEL_CATALOG.modulePath, avantelModulePath)

  assert.equal(avantel.PROVIDER_METADATA.source, AVANTEL_CATALOG.source)
  assert.equal(avantel.PROVIDER_METADATA.companyName, AVANTEL_CATALOG.companyName)
  assert.equal(avantel.PROVIDER_METADATA.bundleUrl, AVANTEL_CATALOG.bundleUrl)
  assert.deepEqual(avantel.VERIFIED_ROLE_TITLES, VERIFIED_ROLE_TITLES)
})

test('Avantel backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { AVANTEL_CATALOG } = await loadAvantelCatalog()
  const provider = hydrateProviderCatalogEntry(AVANTEL_CATALOG)

  assert.equal(provider.companyName, 'Avantel')
  assert.equal(provider.companyDomain, 'avantel.in')
  assert.match(provider.modulePath, /avantel[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /avantel[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Avantel'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Avantel\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avantel', 'avantel', 'Avantel']],
  )
})

test('buildScrapers and company coverage resolve Avantel from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'avantel')
  const scraper = buildScrapers().find((item) => item.name === 'avantel')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Avantel')
  assert.equal(provider.companyCareerPage, 'https://www.avantel.in/careers')
  assert.match(scraper.dryRunFile, /avantel[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Avantel\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Avantel', 'avantel', 'Avantel']],
  )
})
