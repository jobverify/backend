import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/paltech/script.js')

const loadCatalogModule = async () => import('../../scraper/paltech/catalog.js')

test('PalTech local catalog captures the verified first-party open positions surface', async () => {
  const { PALTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PALTECH_CATALOG)

  assert.equal(defaultCatalog, PALTECH_CATALOG)
  assert.equal(provider.source, 'paltech')
  assert.equal(provider.companyName, 'PalTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://pal-tech.com/careers/')
  assert.equal(provider.companyDomain, 'pal-tech.com')
  assert.equal(provider.atsPlatform, 'official-first-party-open-positions-page')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-first-party-open-positions-section')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+open-positions-section-only+detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /casino bonus/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PalTech'), false)
})

test('PalTech backlog row matches directly from local provider metadata', async () => {
  const { PALTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'PalTech\n',
    catalog: [hydrateProviderCatalogEntry(PALTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source]),
    [['PalTech', 'paltech']],
  )
})

test('PalTech local provider stays script-runner compatible', async () => {
  const { PALTECH_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PALTECH_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(typeof module.run, 'function')
  assert.match(provider.dryRunFile, /paltech[\\/]jobs\.json$/i)
})
