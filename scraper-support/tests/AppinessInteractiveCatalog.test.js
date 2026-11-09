import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/appinessinteractive/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/appinessinteractive/catalog.js')
  } catch {
    assert.fail('Expected Appiness Interactive catalog module at ../../scraper/appinessinteractive/catalog.js')
  }
}

test('Appiness Interactive local catalog captures the verified first-party careers listings', async () => {
  const { APPINESS_INTERACTIVE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APPINESS_INTERACTIVE_CATALOG)

  assert.equal(defaultCatalog, APPINESS_INTERACTIVE_CATALOG)
  assert.equal(provider.source, 'appinessinteractive')
  assert.equal(provider.companyName, 'Appiness Interactive')
  assert.equal(provider.officialBrandName, 'Appiness Interactive Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.appinessworld.com/')
  assert.equal(provider.companyCareerPage, 'https://www.appinessworld.com/careers/job-details/')
  assert.equal(provider.companyDomain, 'appinessworld.com')
  assert.equal(provider.atsPlatform, 'official-first-party-role-sections')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'same-page-role-sections')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedPublicOpeningCount, 25)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /appinessinteractive[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.appinessworld\.com\/careers\/job-details\//i)
  assert.match(provider.verifiedSurfaceSummary, /SEO Expert/i)
  assert.match(provider.verifiedSurfaceSummary, /MERN Stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore/i)
})

test('Appiness Interactive exact backlog row resolves from the local provider contract', async () => {
  const { APPINESS_INTERACTIVE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Appiness Interactive\n',
    catalog: [hydrateProviderCatalogEntry(APPINESS_INTERACTIVE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Appiness Interactive', 'appinessinteractive', 'Appiness Interactive']],
  )
})
