import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bizmaticsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bizmaticsindia/catalog.js')
  } catch {
    assert.fail('Expected Bizmatics India catalog module at ../../scraper/bizmaticsindia/catalog.js')
  }
}

test('Bizmatics India local catalog captures the sold-domain shell with no trustworthy public jobs surface', async () => {
  const { BIZMATICS_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BIZMATICS_INDIA_CATALOG)

  assert.equal(defaultCatalog, BIZMATICS_INDIA_CATALOG)
  assert.equal(provider.source, 'bizmaticsindia')
  assert.equal(provider.companyName, 'Bizmatics India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.bizmatics.com/company/careers/')
  assert.equal(provider.companyDomain, 'bizmatics.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /sold-domain landing experience/i)
  assert.match(provider.verifiedSurfaceSummary, /no alternate official jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bizmatics India'), false)
})

test('Bizmatics India backlog row matches directly from the local catalog', async () => {
  const { BIZMATICS_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bizmatics India\n',
    catalog: [hydrateProviderCatalogEntry(BIZMATICS_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Bizmatics India hydrated local catalog stays script-runner compatible', async () => {
  const { BIZMATICS_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BIZMATICS_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
