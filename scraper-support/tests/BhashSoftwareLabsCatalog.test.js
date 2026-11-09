import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bhashsoftwarelabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bhashsoftwarelabs/catalog.js')
  } catch {
    assert.fail('Expected Bhash Software Labs catalog module at ../../scraper/bhashsoftwarelabs/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Bhash Software Labs local catalog captures the verified homepage and missing careers route', async () => {
  const { BHASH_SOFTWARE_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(BHASH_SOFTWARE_LABS_CATALOG)

  assert.equal(defaultCatalog, BHASH_SOFTWARE_LABS_CATALOG)
  assert.equal(provider.source, 'bhashsoftwarelabs')
  assert.equal(provider.companyName, 'Bhash Software Labs')
  assert.equal(provider.officialBrandName, 'Bhash Softwares')
  assert.equal(provider.companyCareerPage, 'https://bhashsoftware.com/careers')
  assert.equal(provider.atsPlatform, 'official-homepage-plus-missing-careers-route')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /404/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Bhash Software Labs exact backlog row resolves from the local provider contract', async () => {
  const { BHASH_SOFTWARE_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bhash Software Labs\n',
    catalog: [buildProvider(BHASH_SOFTWARE_LABS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
