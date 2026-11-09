import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/verinitetechnologies/script.js')

const loadCatalogModule = async () => import('../../scraper/verinitetechnologies/catalog.js')

test('Verinite Technologies local catalog captures the verified job-card careers page', async () => {
  const { VERINITE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(VERINITE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, VERINITE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'verinitetechnologies')
  assert.equal(provider.companyName, 'Verinite Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.verinite.com/careers.html')
  assert.equal(provider.companyDomain, 'verinite.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-card-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-job-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+job-cards+detail-links',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Powercard L2 Support/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Verinite Technologies'), false)
})

test('Verinite Technologies backlog row matches directly from local provider metadata', async () => {
  const { VERINITE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Verinite Technologies\n',
    catalog: [hydrateProviderCatalogEntry(VERINITE_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Verinite Technologies local provider stays script-runner compatible', async () => {
  const { VERINITE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(VERINITE_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(typeof module.run, 'function')
  assert.match(provider.dryRunFile, /verinitetechnologies[\\/]jobs\.json$/i)
})
