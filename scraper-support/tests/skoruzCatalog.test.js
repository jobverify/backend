import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/skoruz/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/skoruz/catalog.js')
  } catch {
    assert.fail('Expected Skoruz catalog module at ../../scraper/skoruz/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/skoruz/script.js')
  } catch {
    assert.fail('Expected Skoruz scraper module at ../../scraper/skoruz/script.js')
  }
}

test('Skoruz local catalog captures the verified fail-closed careers surface', async () => {
  const { SKORUZ_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const skoruz = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SKORUZ_CATALOG)

  assert.equal(defaultCatalog, SKORUZ_CATALOG)
  assert.equal(provider.source, 'skoruz')
  assert.equal(provider.companyName, 'Skoruz')
  assert.equal(provider.officialBrandName, 'Skoruz Technologies Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.skoruz.com/')
  assert.equal(provider.companyCareerPage, 'https://www.skoruz.com/careers/')
  assert.equal(provider.embeddedIndiaJobsUrl, 'https://talenthire.ceipal.in/Jobs/listing/MTAz')
  assert.equal(provider.companyDomain, 'skoruz.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-with-public-us-postings-and-untrusted-ceipal-embed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page+visible-us-postings+india-ceipal-timeout-sentinel',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+extract-public-us-postings+india-untrusted-iframe-fallback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /skoruz[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.skoruz\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/talenthire\.ceipal\.in\/Jobs\/listing\/MTAz/i)
  assert.match(provider.verifiedSurfaceSummary, /August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Network and Computer Systems Administrator/i)
  assert.match(provider.verifiedSurfaceSummary, /San Jose, CA/i)
  assert.match(provider.verifiedSurfaceSummary, /timed out|could not connect/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Skoruz'), false)

  assert.equal(skoruz.PROVIDER_METADATA.source, SKORUZ_CATALOG.source)
  assert.equal(skoruz.PROVIDER_METADATA.companyName, SKORUZ_CATALOG.companyName)
  assert.equal(skoruz.PROVIDER_METADATA.companyCareerPage, SKORUZ_CATALOG.companyCareerPage)
})

test('Skoruz exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SKORUZ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Skoruz\n',
    catalog: [hydrateProviderCatalogEntry(SKORUZ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Skoruz', 'skoruz', 'Skoruz']],
  )
})
