import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const providerModulePath = path.resolve(currentDir, '../../scraper/stackpath/script.js')
const resolvedModulePath = providerModulePath

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stackpath/catalog.js')
  } catch {
    assert.fail('Expected StackPath catalog module at ../../scraper/stackpath/catalog.js')
  }
}

test('StackPath local catalog captures the verified exact-name empty-shell sentinel state', async () => {
  const { STACKPATH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(STACKPATH_CATALOG)

  assert.equal(defaultCatalog, STACKPATH_CATALOG)
  assert.equal(provider.source, 'stackpath')
  assert.equal(provider.companyName, 'StackPath')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.stackpath.com/')
  assert.equal(provider.companyDomain, 'stackpath.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(
    provider.paginationStrategy,
    'exact-name-first-party-root-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-first-party-root-empty-shell+verified-common-careers-routes-404-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, providerModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /404 ERROR/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public openings surface/i)
})

test('StackPath exact backlog row matches from the local catalog entry', async () => {
  const { STACKPATH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'StackPath\n',
    catalog: [hydrateProviderCatalogEntry(STACKPATH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('StackPath shared provider catalog entry is present and script-runner compatible', async () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'stackpath')

  assert.ok(provider)
  assert.equal(provider.companyName, 'StackPath')
  assert.equal(provider.companyCareerPage, 'https://www.stackpath.com/')
  assert.equal(provider.companyDomain, 'stackpath.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(provider.modulePath, providerModulePath)

  const module = await import(pathToFileURL(resolvedModulePath).href)
  assert.equal(typeof module.run, 'function')
})
