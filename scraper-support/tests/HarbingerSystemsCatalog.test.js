import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/harbingersystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/harbingersystems/catalog.js')
  } catch {
    assert.fail('Expected Harbinger Systems catalog module at ../../scraper/harbingersystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/harbingersystems/script.js')
  } catch {
    assert.fail('Expected Harbinger Systems scraper module at ../../scraper/harbingersystems/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Harbinger Systems local catalog captures the verified first-party Darwinbox handoff and live India jobs surface', async () => {
  const { HARBINGER_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const harbinger = await loadScriptModule()
  const provider = buildCatalogReadyProvider(HARBINGER_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, HARBINGER_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'harbingersystems')
  assert.equal(provider.companyName, 'Harbinger Systems')
  assert.equal(provider.officialBrandName, 'Harbinger Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.harbingergroup.com/')
  assert.equal(provider.companyCareerPage, 'https://www.harbingergroup.com/current-openings/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://harbingergroup.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://harbingergroup.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'page-number')
  assert.equal(provider.extractionStrategy, 'browser-verified-darwinbox-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'harbingergroup.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /harbingergroup\.darwinbox\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Test Engineer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /harbingersystems[\\/]jobs\.json$/i)

  assert.equal(harbinger.PROVIDER_METADATA.source, provider.source)
  assert.equal(harbinger.PROVIDER_METADATA.darwinboxOrigin, provider.darwinboxOrigin)
})

test('Harbinger Systems exact backlog row resolves from the local provider contract', async () => {
  const { HARBINGER_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Harbinger Systems\n',
    catalog: [buildCatalogReadyProvider(HARBINGER_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Harbinger Systems', 'harbingersystems', 'Harbinger Systems']],
  )
})
