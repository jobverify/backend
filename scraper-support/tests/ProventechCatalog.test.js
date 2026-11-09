import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/proventech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/proventech/catalog.js')
  } catch {
    assert.fail('Expected Proventech catalog module at ../../scraper/proventech/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Proventech local catalog captures the verified no-public-careers HRMS shell', async () => {
  const { PROVENTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(PROVENTECH_CATALOG)

  assert.equal(defaultCatalog, PROVENTECH_CATALOG)
  assert.equal(provider.source, 'proventech')
  assert.equal(provider.companyName, 'Proventech')
  assert.equal(provider.officialBrandName, 'ProvenTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://hr.proventech.in/')
  assert.equal(provider.companyCareerPage, 'https://hr.proventech.in/')
  assert.equal(provider.applyUrl, 'https://hr.proventech.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-login-shell-plus-missing-routes')
  assert.equal(provider.extractionStrategy, 'verified-login-shell+verified-missing-careers-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'proventech.in')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /HRMS login shell/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hr\.proventech\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /legacy https:\/\/new\.proventech\.in\/ host now fails TLS/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /proventech[\\/]jobs\.json$/i)
})

test('Proventech exact backlog row resolves from the local provider contract', async () => {
  const { PROVENTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Proventech\n',
    catalog: [buildCatalogReadyProvider(PROVENTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Proventech', 'proventech', 'Proventech']],
  )
})
