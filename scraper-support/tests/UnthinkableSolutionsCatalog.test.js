import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/unthinkablesolutions/script.js')

const loadCatalogModule = async () => import('../../scraper/unthinkablesolutions/catalog.js')

test('Unthinkable Solutions local catalog captures the verified careers shell without structured vacancies', async () => {
  const { UNTHINKABLE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(UNTHINKABLE_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, UNTHINKABLE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'unthinkablesolutions')
  assert.equal(provider.companyName, 'Unthinkable Solutions')
  assert.equal(provider.companyCareerPage, 'https://www.unthinkable.co/career/')
  assert.equal(provider.companyDomain, 'unthinkable.co')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Open Vacancies/i)
  assert.match(provider.verifiedSurfaceSummary, /Build Your Career with Us/i)
  assert.equal(typeof module.run, 'function')
})

test('Unthinkable Solutions exact backlog row resolves from the local catalog', async () => {
  const { UNTHINKABLE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Unthinkable Solutions\n',
    catalog: [hydrateProviderCatalogEntry(UNTHINKABLE_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
