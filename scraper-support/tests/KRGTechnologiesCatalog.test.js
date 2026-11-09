import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/krgtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/krgtechnologies/catalog.js')
  } catch {
    assert.fail('Expected KRG Technologies catalog module at ../../scraper/krgtechnologies/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({ ...catalogEntry, modulePath })

test('KRG Technologies local catalog captures the verified CEIPAL iframe handoff', async () => {
  const { KRG_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = buildProvider(KRG_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'krgtechnologies')
  assert.equal(provider.companyName, 'KRG Technologies')
  assert.equal(provider.externalBoardUrl, 'https://talenthire.ceipal.com/Jobs/listing/ODI0MA==')
  assert.match(provider.verifiedSurfaceSummary, /CEIPAL/i)
})

test('KRG Technologies exact backlog row resolves from the local provider contract', async () => {
  const { KRG_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KRG Technologies\n',
    catalog: [buildProvider(KRG_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
