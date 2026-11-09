import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/pramatitechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pramatitechnologies/catalog.js')
  } catch {
    assert.fail('Expected Pramati Technologies catalog module at ../../scraper/pramatitechnologies/catalog.js')
  }
}

test('Pramati Technologies local catalog captures the first-party homepage plus opaque careers handoff fail-closed contract', async () => {
  const { PRAMATI_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PRAMATI_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, PRAMATI_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'pramatitechnologies')
  assert.equal(provider.companyName, 'Pramati Technologies')
  assert.equal(provider.officialBrandName, 'Pramati')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://pramati.com/')
  assert.equal(provider.companyCareerPage, 'https://pramati.com/careers/')
  assert.equal(provider.linkedCareersBoardUrl, 'https://recruitcareers.zappyhire.com/pramati')
  assert.equal(provider.companyDomain, 'pramati.com')
  assert.equal(provider.atsPlatform, 'first-party-homepage-plus-opaque-linked-zappyhire-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-link-plus-missing-careers-route-plus-opaque-zappyhire-shell')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-link+verified-404-careers-route+verified-opaque-zappyhire-shell+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pramati\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pramati\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/recruitcareers\.zappyhire\.com\/pramati/i)
  assert.match(provider.verifiedSurfaceSummary, /opaque careers shell/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pramatitechnologies[\\/]jobs\.json$/i)
})

test('Pramati Technologies backlog row matches directly from the local catalog', async () => {
  const { PRAMATI_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pramati Technologies\n',
    catalog: [hydrateProviderCatalogEntry(PRAMATI_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
