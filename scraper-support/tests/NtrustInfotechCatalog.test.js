import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ntrustinfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ntrustinfotech/catalog.js')
  } catch {
    assert.fail('Expected Ntrust Infotech catalog module at ../../scraper/ntrustinfotech/catalog.js')
  }
}

test('Ntrust Infotech local catalog captures the generic ATS handoff fail-closed contract', async () => {
  const { NTRUST_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NTRUST_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, NTRUST_INFOTECH_CATALOG)
  assert.equal(provider.source, 'ntrustinfotech')
  assert.equal(provider.companyName, 'Ntrust Infotech')
  assert.equal(provider.officialBrandName, 'NTrust Infotech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ntrustinfotech.com/careers/')
  assert.equal(provider.companyDomain, 'ntrustinfotech.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-generic-ats-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-page-with-placeholder-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-copy+placeholder-role-cards-with-href-hash+generic-ats-note+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /applicant tracking system/i)
  assert.match(provider.verifiedSurfaceSummary, /Engineering & Data Science/i)
  assert.match(provider.verifiedSurfaceSummary, /href=\"#\"/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ntrustinfotech[\\/]jobs\.json$/i)
})

test('Ntrust Infotech backlog row matches directly from the local catalog', async () => {
  const { NTRUST_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ntrust Infotech\n',
    catalog: [hydrateProviderCatalogEntry(NTRUST_INFOTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
