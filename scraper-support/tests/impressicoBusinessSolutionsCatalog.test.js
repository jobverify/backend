import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/impressicobusinesssolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/impressicobusinesssolutions/catalog.js')
  } catch {
    assert.fail('Expected Impressico Business Solutions catalog module at ../../scraper/impressicobusinesssolutions/catalog.js')
  }
}

test('Impressico Business Solutions local catalog captures the verified first-party inline openings surface', async () => {
  const { IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'impressicobusinesssolutions')
  assert.equal(provider.companyName, 'Impressico Business Solutions')
  assert.equal(provider.officialBrandName, 'Impressico Business Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.impressico.com/career/')
  assert.equal(provider.companyDomain, 'impressico.com')
  assert.equal(provider.atsPlatform, 'official-company-site-inline-openings-and-modals')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-inline-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+career-block-cards+modal-details+same-page-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Pre-Sales Consultant/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /impressicobusinesssolutions[\\/]jobs\.json$/i)
})
