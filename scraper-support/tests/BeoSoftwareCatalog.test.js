import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/beosoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/beosoftware/catalog.js')
  } catch {
    assert.fail('Expected BEO Software catalog module at ../../scraper/beosoftware/catalog.js')
  }
}

test('BEO Software local catalog captures the verified first-party jobs surface', async () => {
  const { BEO_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(BEO_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, BEO_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'beosoftware')
  assert.equal(provider.companyName, 'BEO Software')
  assert.equal(provider.officialBrandName, 'BEO Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://beo-software.in/careers')
  assert.equal(provider.companyDomain, 'beo-software.in')
  assert.equal(provider.atsPlatform, 'official-first-party-job-cards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+same-page-job-list+first-party-detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Full-Stack Node\.js Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Full-Stack Developer/i)
})
