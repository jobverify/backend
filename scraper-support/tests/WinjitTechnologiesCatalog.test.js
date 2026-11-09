import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/winjittechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/winjittechnologies/catalog.js')
  } catch {
    assert.fail('Expected Winjit Technologies catalog module at ../../scraper/winjittechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('Winjit Technologies local catalog captures the verified Sucuri-blocked first-party surface', async () => {
  const { WINJIT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = buildProvider(WINJIT_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'winjittechnologies')
  assert.equal(provider.companyName, 'Winjit Technologies')
  assert.equal(provider.atsPlatform, 'official-domain-blocked-by-sucuri')
  assert.match(provider.verifiedSurfaceSummary, /Sucuri interstitial/i)
})

test('Winjit Technologies exact backlog row resolves from the local provider contract', async () => {
  const { WINJIT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Winjit Technologies\n',
    catalog: [buildProvider(WINJIT_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
