import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/proziodanalytics/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/proziodanalytics/catalog.js')
  } catch {
    assert.fail('Expected Proziod Analytics catalog module at ../../scraper/proziodanalytics/catalog.js')
  }
}

test('Proziod Analytics local catalog captures the verified first-party GoHire board contract', async () => {
  const { PROZIOD_ANALYTICS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PROZIOD_ANALYTICS_CATALOG)

  assert.equal(defaultCatalog, PROZIOD_ANALYTICS_CATALOG)
  assert.equal(provider.source, 'proziodanalytics')
  assert.equal(provider.companyName, 'Proziod Analytics')
  assert.equal(provider.officialBrandName, 'Proziod Analytics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://proziod.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.proziod.com/')
  assert.equal(provider.companyDomain, 'careers.proziod.com')
  assert.equal(provider.atsPlatform, 'gohire')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-board-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-gohire-board+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /proziodanalytics[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.proziod\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /3 open jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Design Verification Engineers \(DV\)/i)
})

test('Proziod Analytics exact backlog row resolves directly from the local provider contract', async () => {
  const { PROZIOD_ANALYTICS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Proziod Analytics\n',
    catalog: [hydrateProviderCatalogEntry(PROZIOD_ANALYTICS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Proziod Analytics', 'proziodanalytics', 'Proziod Analytics']],
  )
})

test('Proziod Analytics hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { PROZIOD_ANALYTICS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PROZIOD_ANALYTICS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.proziod.com/')
  assert.equal(provider.companyDomain, 'careers.proziod.com')
  assert.match(provider.modulePath, /proziodanalytics[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
