import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ayninfotech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ayninfotech/catalog.js')
  } catch {
    assert.fail('Expected AYN InfoTech catalog module at ../../scraper/ayninfotech/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('AYN InfoTech local catalog records the verified untrusted first-party domain state', async () => {
  const { AYN_INFOTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(AYN_INFOTECH_CATALOG)

  assert.equal(defaultCatalog, AYN_INFOTECH_CATALOG)
  assert.equal(provider.source, 'ayninfotech')
  assert.equal(provider.companyName, 'AYN InfoTech')
  assert.equal(provider.officialBrandName, 'AYN InfoTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.ayninfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.ayninfotech.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-untrusted-domain')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-and-common-career-route-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-untrusted-first-party-domain-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ayninfotech.com')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /redirected outside the company domain/i)
  assert.match(provider.verifiedSurfaceSummary, /bigskyworldview\.org/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ayninfotech[\\/]jobs\.json$/i)
})

test('AYN InfoTech exact backlog row resolves from the local sentinel contract without aliases', async () => {
  const { AYN_INFOTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AYN InfoTech\n',
    catalog: [buildCatalogReadyProvider(AYN_INFOTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AYN InfoTech', 'ayninfotech', 'AYN InfoTech']],
  )
})
