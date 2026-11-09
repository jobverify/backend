import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dataflowgroup/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dataflowgroup/catalog.js')
  } catch {
    assert.fail('Expected Dataflow Group catalog module at ../../scraper/dataflowgroup/catalog.js')
  }
}

test('Dataflow Group local catalog captures the blocked Darwinbox handoff and fail-closed behavior', async () => {
  const { DATAFLOW_GROUP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DATAFLOW_GROUP_CATALOG)

  assert.equal(defaultCatalog, DATAFLOW_GROUP_CATALOG)
  assert.equal(provider.source, 'dataflowgroup')
  assert.equal(provider.companyName, 'Dataflow Group')
  assert.equal(provider.officialBrandName, 'DATAFLOW')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://dataflowgroup.com/careers/')
  assert.equal(provider.companyDomain, 'dataflowgroup.com')
  assert.equal(provider.allVacanciesUrl, 'https://dataflowgroup.com/all-vacancies/')
  assert.equal(provider.darwinboxIframeUrl, 'https://dataflowgroup.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-blocked-darwinbox-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-handoff-validation-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+iframe-handoff+blocked-public-darwinbox-surface-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /EXPLORE ALL VACANCIES/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dataflowgroup[\\/]jobs\.json$/i)
})
