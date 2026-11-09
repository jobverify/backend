import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/noccarc/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/noccarc/catalog.js')
  } catch {
    assert.fail('Expected Noccarc catalog module at ../../scraper/noccarc/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/noccarc/script.js')
  } catch {
    assert.fail('Expected Noccarc scraper module at ../../scraper/noccarc/script.js')
  }
}

test('Noccarc local catalog captures the verified first-party careers page and inline role-card surface', async () => {
  const { NOCCARC_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const noccarc = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NOCCARC_CATALOG)

  assert.equal(defaultCatalog, NOCCARC_CATALOG)
  assert.equal(provider.source, 'noccarc')
  assert.equal(provider.companyName, 'Noccarc')
  assert.equal(provider.officialBrandName, 'Noccarc Robotics Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.noccarc.com/careers')
  assert.equal(provider.publicJobListingHost, 'noccarc.com')
  assert.equal(provider.applicationUrl, 'mailto:careers@noccarc.com?subject=Apply%20for%20Job%20at%20Noccarc')
  assert.equal(provider.companyDomain, 'noccarc.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-first-party-inline-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+same-page-inline-role-cards+shared-email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.modulePath, /noccarc[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.noccarc\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /mailto:careers@noccarc\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Regional Sales Manager - South/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Systems Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Field Service Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)

  assert.equal(noccarc.PROVIDER_METADATA.source, NOCCARC_CATALOG.source)
  assert.equal(noccarc.PROVIDER_METADATA.companyName, NOCCARC_CATALOG.companyName)
  assert.equal(noccarc.PROVIDER_METADATA.companyCareerPage, NOCCARC_CATALOG.companyCareerPage)
})

test('Noccarc exact backlog row matches directly from local provider metadata', async () => {
  const { NOCCARC_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Noccarc\n',
    catalog: [hydrateProviderCatalogEntry(NOCCARC_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Noccarc', 'noccarc', 'Noccarc']],
  )
})

test('Noccarc hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NOCCARC_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NOCCARC_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Noccarc')
  assert.equal(provider.companyCareerPage, 'https://www.noccarc.com/careers')
  assert.equal(provider.companyDomain, 'noccarc.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.match(provider.modulePath, /noccarc[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
