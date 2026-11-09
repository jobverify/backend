import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/paramatrixtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/paramatrixtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Paramatrix Technologies catalog module at ../../scraper/paramatrixtechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Paramatrix Technologies local catalog captures the verified first-party careers listings surface', async () => {
  const { PARAMATRIX_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(PARAMATRIX_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, PARAMATRIX_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'paramatrixtechnologies')
  assert.equal(provider.companyName, 'Paramatrix Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.paramatrix.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-inline-apply-modals')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /talent network/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Paramatrix Technologies exact backlog row resolves from the local provider contract', async () => {
  const { PARAMATRIX_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Paramatrix Technologies\n',
    catalog: [buildProvider(PARAMATRIX_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
