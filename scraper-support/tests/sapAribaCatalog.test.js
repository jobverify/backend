import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sapariba/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sapariba/catalog.js')
  } catch {
    assert.fail('Expected SAP Ariba catalog module at ../../scraper/sapariba/catalog.js')
  }
}

test('SAP Ariba local catalog captures the generic-parent-brand-only careers evidence', async () => {
  const { default: catalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(catalog)

  assert.equal(provider.source, 'sapariba')
  assert.equal(provider.companyName, 'SAP Ariba')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sap.com/about/careers.html')
  assert.equal(provider.companyDomain, 'sap.com')
  assert.equal(provider.atsPlatform, 'generic-parent-brand-careers-only')
  assert.equal(provider.paginationStrategy, 'fail-closed')
  assert.equal(provider.extractionStrategy, 'exact-name-absence-on-generic-sap-careers')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy exact-name SAP Ariba/i)
})
