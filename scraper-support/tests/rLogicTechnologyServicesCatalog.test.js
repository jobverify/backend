import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rlogictechnologyservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rlogictechnologyservices/catalog.js')
  } catch {
    assert.fail('Expected R-Logic Technology Services catalog module at ../../scraper/rlogictechnologyservices/catalog.js')
  }
}

test('R-Logic Technology Services local catalog captures the no-public-jobs first-party careers-culture surface', async () => {
  const { R_LOGIC_TECHNOLOGY_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(R_LOGIC_TECHNOLOGY_SERVICES_CATALOG)

  assert.equal(defaultCatalog, R_LOGIC_TECHNOLOGY_SERVICES_CATALOG)
  assert.equal(provider.source, 'rlogictechnologyservices')
  assert.equal(provider.companyName, 'R-Logic Technology Services')
  assert.equal(provider.officialBrandName, 'R-Logic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.r-logic.com/careers-culture/')
  assert.equal(provider.companyDomain, 'r-logic.com')
  assert.equal(provider.contactPageUrl, 'https://www.r-logic.com/contact-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-culture-page-contact-handoff')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-culture-page+contact-handoff+no-public-job-listings',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers and Culture/i)
  assert.match(provider.verifiedSurfaceSummary, /Employee Stories/i)
  assert.match(provider.verifiedSurfaceSummary, /Join Our Team/i)
  assert.match(provider.verifiedSurfaceSummary, /Get Started/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers at R-Logic/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /rlogictechnologyservices[\\/]jobs\.json$/i)
})
