import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cyntexa/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cyntexa/catalog.js')
  } catch {
    assert.fail('Expected Cyntexa catalog module at ../../scraper/cyntexa/catalog.js')
  }
}

test('Cyntexa local catalog captures the verified first-party careers index and detail pages', async () => {
  const { CYNTEXA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CYNTEXA_CATALOG)

  assert.equal(defaultCatalog, CYNTEXA_CATALOG)
  assert.equal(provider.source, 'cyntexa')
  assert.equal(provider.companyName, 'Cyntexa')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://cyntexa.com/careers/')
  assert.equal(provider.companyDomain, 'cyntexa.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.paginationStrategy, 'single-first-party-index-plus-detail-pages')
  assert.equal(provider.extractionStrategy, 'verified-careers-index-plus-first-party-detail-pages')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Job Opportunities/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Developer/i)
})

test('Cyntexa exact backlog row matches from the local catalog entry', async () => {
  const { CYNTEXA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cyntexa\n',
    catalog: [hydrateProviderCatalogEntry(CYNTEXA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Cyntexa hydrated local catalog stays script-runner compatible', async () => {
  const { CYNTEXA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CYNTEXA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.match(provider.modulePath, /cyntexa[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
