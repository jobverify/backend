import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/aresssoftwareandeducationtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aresssoftwareandeducationtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Aress Software and Education Technologies catalog module at ../../scraper/aresssoftwareandeducationtechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aresssoftwareandeducationtechnologies/script.js')
  } catch {
    assert.fail('Expected Aress Software and Education Technologies scraper module at ../../scraper/aresssoftwareandeducationtechnologies/script.js')
  }
}

test('Aress Software and Education Technologies local catalog captures the verified first-party careers page', async () => {
  const { ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'aresssoftwareandeducationtechnologies')
  assert.equal(provider.companyName, 'Aress Software and Education Technologies')
  assert.equal(provider.officialBrandName, 'Aress Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aress.com/careers/')
  assert.equal(provider.companyDomain, 'aress.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-cards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+division-job-cards+same-page-details-handoff',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Digital Marketing Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /Nashik/i)

  const aress = await loadScriptModule()
  assert.equal(aress.PROVIDER_METADATA.source, ARESS_SOFTWARE_AND_EDUCATION_TECHNOLOGIES_CATALOG.source)
})
