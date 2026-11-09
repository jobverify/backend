import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/teliolabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/teliolabs/catalog.js')
  } catch {
    assert.fail('Expected Teliolabs catalog module at ../../scraper/teliolabs/catalog.js')
  }
}

test('Teliolabs local catalog captures the verified first-party wp-job-openings contract', async () => {
  const { TELIOLABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TELIOLABS_CATALOG)

  assert.equal(defaultCatalog, TELIOLABS_CATALOG)
  assert.equal(provider.source, 'teliolabs')
  assert.equal(provider.companyName, 'Teliolabs')
  assert.equal(provider.officialBrandName, 'Teliolabs Communications Inc.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://teliolabs.com/')
  assert.equal(provider.companyCareerPage, 'https://teliolabs.com/job-openings/')
  assert.equal(provider.companyDomain, 'teliolabs.com')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-archive')
  assert.equal(provider.extractionStrategy, 'verified-first-party-jobs-archive+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /teliolabs[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/teliolabs\.com\/job-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud Native Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Junior Perl Developer/i)
})

test('Teliolabs exact backlog row resolves directly from the local provider contract', async () => {
  const { TELIOLABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Teliolabs\n',
    catalog: [hydrateProviderCatalogEntry(TELIOLABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Teliolabs', 'teliolabs', 'Teliolabs']],
  )
})

test('Teliolabs hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TELIOLABS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TELIOLABS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://teliolabs.com/job-openings/')
  assert.equal(provider.companyDomain, 'teliolabs.com')
  assert.match(provider.modulePath, /teliolabs[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
