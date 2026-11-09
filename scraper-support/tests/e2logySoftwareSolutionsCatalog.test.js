import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/e2logysoftwaresolutions/script.js')

const loadCatalogModule = async () => import('../../scraper/e2logysoftwaresolutions/catalog.js')

test('E2logy Software Solutions local catalog captures the verified current first-party careers contract', async () => {
  const { E2LOGY_SOFTWARE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(E2LOGY_SOFTWARE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, E2LOGY_SOFTWARE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'e2logysoftwaresolutions')
  assert.equal(provider.companyName, 'E2logy Software Solutions')
  assert.equal(provider.companyCareerPage, 'https://e2logy.com/careers')
  assert.equal(provider.companyDomain, 'e2logy.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-empty-state-or-embedded-zoho-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-empty-state+legacy-zoho-only-when-embedded',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 8, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /zohorecruit/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'E2logy Software Solutions'), false)
})

test('E2logy Software Solutions backlog row matches directly from local provider metadata', async () => {
  const { E2LOGY_SOFTWARE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'E2logy Software Solutions\n',
    catalog: [hydrateProviderCatalogEntry(E2LOGY_SOFTWARE_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('E2logy Software Solutions local provider stays script-runner compatible', async () => {
  const { E2LOGY_SOFTWARE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(E2LOGY_SOFTWARE_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(typeof module.run, 'function')
  assert.match(provider.dryRunFile, /e2logysoftwaresolutions[\\/]jobs\.json$/i)
})
