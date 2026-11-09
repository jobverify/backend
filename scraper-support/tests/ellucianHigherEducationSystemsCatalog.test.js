import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ellucianhighereducationsystems/script.js')

const loadCatalogModule = async () => import('../../scraper/ellucianhighereducationsystems/catalog.js')

test('Ellucian Higher Education Systems local catalog captures the verified India Jibe search contract', async () => {
  const { ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG, default: defaultCatalog } =
    await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'ellucianhighereducationsystems')
  assert.equal(provider.companyName, 'Ellucian Higher Education Systems')
  assert.equal(provider.companyCareerPage, 'https://careers.ellucian.com/jobs/locations/country/India')
  assert.equal(provider.companyDomain, 'careers.ellucian.com')
  assert.equal(provider.atsPlatform, 'official-jibe-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'jibe-india-location-page-plus-public-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-location-page+verified-jibe-public-jobs-api+empty-india-results',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs\/locations\/country\/India/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ellucian Higher Education Systems'), false)
})

test('Ellucian Higher Education Systems backlog row matches directly from local provider metadata', async () => {
  const { ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ellucian Higher Education Systems\n',
    catalog: [hydrateProviderCatalogEntry(ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Ellucian Higher Education Systems local provider stays script-runner compatible', async () => {
  const { ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ELLUCIAN_HIGHER_EDUCATION_SYSTEMS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(typeof module.run, 'function')
  assert.match(provider.dryRunFile, /ellucianhighereducationsystems[\\/]jobs\.json$/i)
})
