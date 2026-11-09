import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/focussoftnet/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/focussoftnet/catalog.js')
  } catch {
    assert.fail('Expected Focus Softnet catalog module at ../../scraper/focussoftnet/catalog.js')
  }
}

test('Focus Softnet local catalog captures the verified first-party careers page', async () => {
  const { FOCUS_SOFTNET_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FOCUS_SOFTNET_CATALOG)

  assert.equal(defaultCatalog, FOCUS_SOFTNET_CATALOG)
  assert.equal(provider.source, 'focussoftnet')
  assert.equal(provider.companyName, 'Focus Softnet')
  assert.equal(provider.officialBrandName, 'Focus Softnet')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.focussoftnet.com/careers')
  assert.equal(provider.companyDomain, 'focussoftnet.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-landing-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page-inline-role-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Join Our Global Team/i)
  assert.match(provider.verifiedSurfaceSummary, /Social Media Specialist/i)
})

test('Focus Softnet exact backlog row matches from the local catalog entry', async () => {
  const { FOCUS_SOFTNET_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Focus Softnet\n',
    catalog: [hydrateProviderCatalogEntry(FOCUS_SOFTNET_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Focus Softnet', 'focussoftnet', 'Focus Softnet']],
  )
})

test('Focus Softnet hydrated local catalog stays script-runner compatible', async () => {
  const { FOCUS_SOFTNET_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FOCUS_SOFTNET_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.focussoftnet.com/careers')
  assert.match(provider.modulePath, /focussoftnet[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
