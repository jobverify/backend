import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/algoworkstechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/algoworkstechnologies/catalog.js')
  } catch {
    assert.fail('Expected Algoworks Technologies catalog module at ../../scraper/algoworkstechnologies/catalog.js')
  }
}

test('Algoworks Technologies local catalog captures the first-party careers page that hands candidates to an email contact instead of structured listings', async () => {
  const { ALGOWORKS_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ALGOWORKS_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, ALGOWORKS_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'algoworkstechnologies')
  assert.equal(provider.companyName, 'Algoworks Technologies')
  assert.equal(provider.officialBrandName, 'Algoworks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.algoworks.com/careers/')
  assert.equal(provider.companyDomain, 'algoworks.com')
  assert.equal(provider.atsPlatform, 'official-company-site-email-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-email-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+resume-email-handoff+no-first-party-job-listings',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Email the Careers team/i)
  assert.match(provider.verifiedSurfaceSummary, /no structured first-party openings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /algoworkstechnologies[\\/]jobs\.json$/i)
})
