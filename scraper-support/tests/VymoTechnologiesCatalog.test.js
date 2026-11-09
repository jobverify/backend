import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/vymotechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/vymotechnologies/catalog.js')
  } catch {
    assert.fail('Expected Vymo Technologies catalog module at ../../scraper/vymotechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Vymo Technologies local catalog captures the verified first-party careers page shell', async () => {
  const { VYMO_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(VYMO_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, VYMO_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'vymotechnologies')
  assert.equal(provider.companyName, 'Vymo Technologies')
  assert.equal(provider.officialBrandName, 'Vymo')
  assert.equal(provider.companyCareerPage, 'https://vymo.com/careers/')
  assert.equal(provider.atsPlatform, 'first-party-gatsby-careers-page')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Careers \| Vymo/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Vymo Technologies exact backlog row resolves from the local provider contract', async () => {
  const { VYMO_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Vymo Technologies\n',
    catalog: [buildProvider(VYMO_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
