import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadAdmiralCatalog = async () => {
  try {
    return await import('../../scraper/admiralsolutions/catalog.js')
  } catch {
    assert.fail('Expected Admiral Solutions catalog module at ../../scraper/admiralsolutions/catalog.js')
  }
}

test('Admiral Solutions provider metadata captures the verified first-party vacancies listing surface', async () => {
  const { ADMIRAL_SOLUTIONS_CATALOG } = await loadAdmiralCatalog()
  const provider = hydrateProviderCatalogEntry(ADMIRAL_SOLUTIONS_CATALOG)

  assert.equal(provider.source, 'admiralsolutions')
  assert.equal(provider.companyName, 'Admiral Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://career.admiralsolutions.in/vacancies/')
  assert.equal(provider.companyDomain, 'career.admiralsolutions.in')
  assert.equal(provider.homepageUrl, 'https://www.admiralsolutions.in/')
  assert.equal(provider.atsPlatform, 'official-company-careers-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-vacancies-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-handoff+verified-vacancies-list+first-party-detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /admiralsolutions[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Care Specialist/i)
})

test('Admiral Solutions backlog row matches directly from the local provider metadata', async () => {
  const { ADMIRAL_SOLUTIONS_CATALOG } = await loadAdmiralCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Admiral Solutions\n',
    catalog: [hydrateProviderCatalogEntry(ADMIRAL_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
