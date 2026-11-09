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
const akersModulePath = path.resolve(currentDir, '../../scraper/akersbiosciencesindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/akersbiosciencesindia/catalog.js')
  } catch {
    assert.fail('Expected Akers Biosciences India catalog module at ../../scraper/akersbiosciencesindia/catalog.js')
  }
}

const loadAkersModule = async () => {
  try {
    return await import('../../scraper/akersbiosciencesindia/script.js')
  } catch {
    assert.fail('Expected Akers Biosciences India scraper module at ../../scraper/akersbiosciencesindia/script.js')
  }
}

test('Akers Biosciences India local catalog captures the verified parked exact-name host and current official-host no-public-jobs sentinel state', async () => {
  const { AKERS_BIOSCIENCES_INDIA_CATALOG } = await loadCatalogModule()
  const akers = await loadAkersModule()

  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.source, 'akersbiosciencesindia')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.companyName, 'Akers Biosciences India')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.officialBrandName, 'Akers Biosciences')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.adapter, 'script')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.companyCareerPage, 'https://akersbio.com/')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.companyDomain, 'akersbio.com')
  assert.equal(
    AKERS_BIOSCIENCES_INDIA_CATALOG.parkedExactNameUrl,
    'https://akersbiosciences.com/',
  )
  assert.equal(
    AKERS_BIOSCIENCES_INDIA_CATALOG.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    AKERS_BIOSCIENCES_INDIA_CATALOG.paginationStrategy,
    'verified-parked-exact-name-domain-plus-official-host-missing-job-route-validation',
  )
  assert.equal(
    AKERS_BIOSCIENCES_INDIA_CATALOG.extractionStrategy,
    'verified-parked-exact-name-domain+official-host-no-public-job-routes-return-empty',
  )
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedOn, '2026-07-19')
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.dryRunFile, 'akersbiosciencesindia/jobs.json')
  assert.match(
    AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/akersbiosciences\.com\//i,
  )
  assert.match(
    AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedSurfaceSummary,
    /hugedomains/i,
  )
  assert.match(
    AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/akersbio\.com\//i,
  )
  assert.match(
    AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedSurfaceSummary,
    /first-party 404 pages/i,
  )
  assert.match(
    AKERS_BIOSCIENCES_INDIA_CATALOG.verifiedSurfaceSummary,
    /no trustworthy public jobs surface/i,
  )
  assert.equal(AKERS_BIOSCIENCES_INDIA_CATALOG.modulePath, akersModulePath)

  assert.equal(akers.PROVIDER_METADATA.source, AKERS_BIOSCIENCES_INDIA_CATALOG.source)
  assert.equal(akers.PROVIDER_METADATA.companyName, AKERS_BIOSCIENCES_INDIA_CATALOG.companyName)
  assert.equal(akers.PROVIDER_METADATA.parkedExactNameUrl, AKERS_BIOSCIENCES_INDIA_CATALOG.parkedExactNameUrl)
})

test('Akers Biosciences India local catalog hydrates into coverage without needing a shared alias entry', async () => {
  const { AKERS_BIOSCIENCES_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AKERS_BIOSCIENCES_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Akers Biosciences India')
  assert.equal(provider.companyDomain, 'akersbio.com')
  assert.match(provider.modulePath, /akersbiosciencesindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /akersbiosciencesindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akers Biosciences India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akers Biosciences India', 'akersbiosciencesindia', 'Akers Biosciences India']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Akers Biosciences India'),
    false,
  )
})

test('buildScrapers and company coverage resolve Akers Biosciences India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akersbiosciencesindia')
  const scraper = buildScrapers().find((item) => item.name === 'akersbiosciencesindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akers Biosciences India')
  assert.equal(provider.companyCareerPage, 'https://akersbio.com/')
  assert.match(scraper.dryRunFile, /akersbiosciencesindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akers Biosciences India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akers Biosciences India', 'akersbiosciencesindia', 'Akers Biosciences India']],
  )
})
