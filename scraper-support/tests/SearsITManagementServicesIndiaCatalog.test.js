import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/searsitmanagementservicesindia/script.js')

const loadCatalogModule = async () => import('../../scraper/searsitmanagementservicesindia/catalog.js')

test('Sears IT & Management Services India local catalog captures the verified city-only careers shell', async () => {
  const { SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG)
  assert.equal(provider.source, 'searsitmanagementservicesindia')
  assert.equal(provider.companyName, 'Sears IT & Management Services India')
  assert.equal(provider.companyCareerPage, 'https://searsholdingsindia.in/careers/')
  assert.equal(provider.companyDomain, 'searsholdingsindia.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Pune/i)
  assert.match(provider.verifiedSurfaceSummary, /Hyderabad/i)
  assert.match(provider.verifiedSurfaceSummary, /trustworthy structured job titles or detail links/i)
  assert.equal(typeof module.run, 'function')
})

test('Sears IT & Management Services India exact backlog row resolves from the local catalog', async () => {
  const { SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sears IT & Management Services India\n',
    catalog: [hydrateProviderCatalogEntry(SEARS_IT_MANAGEMENT_SERVICES_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
