import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const airtelDigitalModulePath = path.resolve(currentDir, '../../scraper/airteldigital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/airteldigital/catalog.js')
  } catch {
    assert.fail('Expected Airtel Digital catalog module at ../../scraper/airteldigital/catalog.js')
  }
}

const loadAirtelDigitalModule = async () => {
  try {
    return await import('../../scraper/airteldigital/script.js')
  } catch {
    assert.fail('Expected Airtel Digital scraper module at ../../scraper/airteldigital/script.js')
  }
}

test('Airtel Digital local catalog captures the verified shared Airtel careers surface and no-public-careers sentinel state', async () => {
  const { AIRTEL_DIGITAL_CATALOG } = await loadCatalogModule()
  const airtelDigital = await loadAirtelDigitalModule()

  assert.equal(AIRTEL_DIGITAL_CATALOG.source, 'airteldigital')
  assert.equal(AIRTEL_DIGITAL_CATALOG.companyName, 'Airtel Digital')
  assert.equal(AIRTEL_DIGITAL_CATALOG.officialBrandName, 'Airtel')
  assert.equal(AIRTEL_DIGITAL_CATALOG.adapter, 'script')
  assert.equal(AIRTEL_DIGITAL_CATALOG.companyCareerPage, 'https://careers.airtel.com/')
  assert.equal(AIRTEL_DIGITAL_CATALOG.companyDomain, 'careers.airtel.com')
  assert.equal(
    AIRTEL_DIGITAL_CATALOG.sharedDarwinboxUrl,
    'https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    AIRTEL_DIGITAL_CATALOG.sharedCareersApiUrl,
    'https://careersapi.airtel.com/',
  )
  assert.equal(
    AIRTEL_DIGITAL_CATALOG.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(AIRTEL_DIGITAL_CATALOG.countryFilter, 'India')
  assert.equal(
    AIRTEL_DIGITAL_CATALOG.paginationStrategy,
    'verified-first-party-careers-shell-plus-shared-bundle-and-darwinbox-shell-checks',
  )
  assert.equal(
    AIRTEL_DIGITAL_CATALOG.extractionStrategy,
    'verified-first-party-careers-shell+bundle-config+shared-darwinbox-shell-with-no-distinct-airtel-digital-surface',
  )
  assert.equal(AIRTEL_DIGITAL_CATALOG.parser, 'custom-script')
  assert.equal(AIRTEL_DIGITAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AIRTEL_DIGITAL_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AIRTEL_DIGITAL_CATALOG.dryRunFile, 'airteldigital/jobs.json')
  assert.match(AIRTEL_DIGITAL_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.airtel\.com\//i)
  assert.match(
    AIRTEL_DIGITAL_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.airtel\.com\/static\/js\/main\.57023176\.js/i,
  )
  assert.match(
    AIRTEL_DIGITAL_CATALOG.verifiedSurfaceSummary,
    /https:\/\/airtel\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(
    AIRTEL_DIGITAL_CATALOG.verifiedSurfaceSummary,
    /no distinct Airtel Digital public jobs surface/i,
  )
  assert.equal(AIRTEL_DIGITAL_CATALOG.modulePath, airtelDigitalModulePath)

  assert.equal(airtelDigital.PROVIDER_METADATA.source, AIRTEL_DIGITAL_CATALOG.source)
  assert.equal(airtelDigital.PROVIDER_METADATA.companyName, AIRTEL_DIGITAL_CATALOG.companyName)
  assert.equal(
    airtelDigital.PROVIDER_METADATA.sharedDarwinboxUrl,
    AIRTEL_DIGITAL_CATALOG.sharedDarwinboxUrl,
  )
  assert.equal(
    airtelDigital.PROVIDER_METADATA.sharedCareersApiUrl,
    AIRTEL_DIGITAL_CATALOG.sharedCareersApiUrl,
  )
})

test('Airtel Digital local catalog hydrates into coverage without requiring a shared alias entry', async () => {
  const { AIRTEL_DIGITAL_CATALOG } = await loadCatalogModule()
  const hydratedProvider = hydrateProviderCatalogEntry(AIRTEL_DIGITAL_CATALOG)

  assert.equal(hydratedProvider.companyName, 'Airtel Digital')
  assert.equal(hydratedProvider.companyDomain, 'careers.airtel.com')
  assert.match(hydratedProvider.modulePath, /airteldigital[\\/]script\.js$/i)
  assert.match(hydratedProvider.dryRunFile, /airteldigital[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airtel Digital\n',
    catalog: [hydratedProvider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel Digital', 'airteldigital', 'Airtel Digital']],
  )
})

test('buildScrapers and company coverage resolve Airtel Digital from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'airteldigital')
  const scraper = buildScrapers().find((item) => item.name === 'airteldigital')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Airtel Digital')
  assert.equal(provider.companyCareerPage, 'https://careers.airtel.com/')
  assert.match(scraper.dryRunFile, /airteldigital[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Airtel Digital\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Airtel Digital', 'airteldigital', 'Airtel Digital']],
  )
})
