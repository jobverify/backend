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
const scriptModulePath = path.resolve(currentDir, '../../scraper/anarbusiness/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/anarbusiness/catalog.js')
  } catch {
    assert.fail('Expected Anar Business catalog module at ../../scraper/anarbusiness/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/anarbusiness/script.js')
  } catch {
    assert.fail('Expected Anar Business scraper module at ../../scraper/anarbusiness/script.js')
  }
}

test('Anar Business local catalog captures the verified shutdown homepage and missing careers routes', async () => {
  const { ANAR_BUSINESS_CATALOG } = await loadCatalogModule()
  const anar = await loadScriptModule()

  assert.equal(ANAR_BUSINESS_CATALOG.source, 'anarbusiness')
  assert.equal(ANAR_BUSINESS_CATALOG.companyName, 'Anar Business')
  assert.equal(ANAR_BUSINESS_CATALOG.officialBrandName, 'Anar')
  assert.equal(ANAR_BUSINESS_CATALOG.adapter, 'script')
  assert.equal(ANAR_BUSINESS_CATALOG.companyCareerPage, 'https://www.anar.biz/')
  assert.equal(ANAR_BUSINESS_CATALOG.homepageUrl, 'https://www.anar.biz/')
  assert.equal(ANAR_BUSINESS_CATALOG.companyDomain, 'anar.biz')
  assert.equal(
    ANAR_BUSINESS_CATALOG.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(ANAR_BUSINESS_CATALOG.countryFilter, 'India')
  assert.equal(
    ANAR_BUSINESS_CATALOG.paginationStrategy,
    'shutdown-homepage-plus-retired-route-validation',
  )
  assert.equal(
    ANAR_BUSINESS_CATALOG.extractionStrategy,
    'verified-first-party-shutdown+verified-retired-careers-routes-return-empty',
  )
  assert.equal(ANAR_BUSINESS_CATALOG.parser, 'custom-script')
  assert.equal(ANAR_BUSINESS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ANAR_BUSINESS_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(ANAR_BUSINESS_CATALOG.modulePath, scriptModulePath)
  assert.deepEqual(ANAR_BUSINESS_CATALOG.verifiedMissingCareersUrls, [
    'https://www.anar.biz/career',
    'https://www.anar.biz/careers',
    'https://www.anar.biz/jobs',
    'https://www.anar.biz/join-us',
    'https://www.anar.biz/work-with-us',
  ])
  assert.match(ANAR_BUSINESS_CATALOG.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(ANAR_BUSINESS_CATALOG.verifiedSurfaceSummary, /first-party Anar shutdown message/i)
  assert.match(ANAR_BUSINESS_CATALOG.verifiedSurfaceSummary, /HTTP 410/i)
  assert.match(ANAR_BUSINESS_CATALOG.verifiedSurfaceSummary, /No public Anar jobs surface is available/i)

  assert.equal(anar.PROVIDER_METADATA.source, ANAR_BUSINESS_CATALOG.source)
  assert.equal(anar.PROVIDER_METADATA.companyName, ANAR_BUSINESS_CATALOG.companyName)
})

test('Anar Business backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ANAR_BUSINESS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ANAR_BUSINESS_CATALOG)

  assert.equal(provider.companyName, 'Anar Business')
  assert.equal(provider.companyDomain, 'anar.biz')
  assert.match(provider.modulePath, /anarbusiness[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /anarbusiness[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anar Business\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anar Business', 'anarbusiness', 'Anar Business']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Anar Business'),
    false,
  )
})

test('buildScrapers and company coverage resolve Anar Business from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anarbusiness')
  const scraper = buildScrapers().find((item) => item.name === 'anarbusiness')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Anar Business')
  assert.equal(provider.companyCareerPage, 'https://www.anar.biz/')
  assert.match(scraper.dryRunFile, /anarbusiness[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anar Business\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anar Business', 'anarbusiness', 'Anar Business']],
  )
})
