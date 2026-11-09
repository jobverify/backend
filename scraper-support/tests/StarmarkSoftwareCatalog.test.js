import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/starmarksoftware/script.js')

const loadCatalogModule = async () => import('../../scraper/starmarksoftware/catalog.js')

test('Starmark Software local catalog captures the verified first-party careers shell without public role cards', async () => {
  const { STARMARK_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(STARMARK_SOFTWARE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, STARMARK_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'starmarksoftware')
  assert.equal(provider.companyName, 'Starmark Software')
  assert.equal(provider.companyCareerPage, 'https://www.starmarksv.com/careers.html')
  assert.equal(provider.companyDomain, 'starmarksv.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.verifiedSurfaceSummary, /Join Our Team/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@starmarksv\.com/i)
  assert.equal(typeof module.run, 'function')
})

test('Starmark Software exact backlog row resolves from the local catalog', async () => {
  const { STARMARK_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Starmark Software\n',
    catalog: [hydrateProviderCatalogEntry(STARMARK_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
