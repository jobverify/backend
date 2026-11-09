import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/americaninfosource/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/americaninfosource/catalog.js')
  } catch {
    assert.fail('Expected American InfoSource catalog module at ../../scraper/americaninfosource/catalog.js')
  }
}

test('American InfoSource local catalog captures the exact-name sentinel state', async () => {
  const { AMERICAN_INFO_SOURCE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMERICAN_INFO_SOURCE_CATALOG)

  assert.equal(defaultCatalog, AMERICAN_INFO_SOURCE_CATALOG)
  assert.equal(provider.source, 'americaninfosource')
  assert.equal(provider.companyName, 'American InfoSource')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://americaninfosource.com/')
  assert.equal(provider.companyDomain, 'americaninfosource.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.paginationStrategy, 'exact-name-domain-root-plus-common-careers-route-timeout-validation')
  assert.equal(provider.extractionStrategy, 'verified-exact-name-first-party-domain-without-trustworthy-public-jobs-return-empty')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /timed out/i)
})

test('American InfoSource exact backlog row matches from the local catalog entry', async () => {
  const { AMERICAN_INFO_SOURCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'American InfoSource\n',
    catalog: [hydrateProviderCatalogEntry(AMERICAN_INFO_SOURCE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('American InfoSource hydrated local catalog stays script-runner compatible', async () => {
  const { AMERICAN_INFO_SOURCE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AMERICAN_INFO_SOURCE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.match(provider.modulePath, /americaninfosource[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
