import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/girmitisoftware/script.js')

const loadCatalogModule = async () => import('../../scraper/girmitisoftware/catalog.js')

test('Girmiti Software local catalog captures the verified current openings page', async () => {
  const { GIRMITI_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GIRMITI_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, GIRMITI_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'girmitisoftware')
  assert.equal(provider.companyName, 'Girmiti Software')
  assert.equal(provider.companyCareerPage, 'https://www.girmiti.com/current_openings.html')
  assert.equal(provider.companyDomain, 'girmiti.com')
  assert.equal(provider.atsPlatform, 'official-first-party-current-openings-page')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'single-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-current-openings-page+inline-role-blocks',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@girmiti\.com/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Girmiti Software'), false)
})

test('Girmiti Software backlog row matches directly from local provider metadata', async () => {
  const { GIRMITI_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Girmiti Software\n',
    catalog: [hydrateProviderCatalogEntry(GIRMITI_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Girmiti Software local provider stays script-runner compatible', async () => {
  const { GIRMITI_SOFTWARE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GIRMITI_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(typeof module.run, 'function')
  assert.match(provider.dryRunFile, /girmitisoftware[\\/]jobs\.json$/i)
})
