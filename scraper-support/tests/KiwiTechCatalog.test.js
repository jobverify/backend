import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/kiwitech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kiwitech/catalog.js')
  } catch {
    assert.fail('Expected KiwiTech catalog module at ../../scraper/kiwitech/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('KiwiTech local catalog captures the verified first-party careers page and inline openings list', async () => {
  const { KIWI_TECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(KIWI_TECH_CATALOG)

  assert.equal(defaultCatalog, KIWI_TECH_CATALOG)
  assert.equal(provider.source, 'kiwitech')
  assert.equal(provider.companyName, 'KiwiTech')
  assert.equal(provider.officialBrandName, 'KiwiTech')
  assert.equal(provider.companyCareerPage, 'https://www.kiwitech.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+inline-openings-list')
  assert.equal(provider.companyDomain, 'kiwitech.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Lead AI & ML/i)
  assert.equal(provider.modulePath, modulePath)
})

test('KiwiTech exact backlog row resolves from the local provider contract', async () => {
  const { KIWI_TECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KiwiTech\n',
    catalog: [buildProvider(KIWI_TECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
