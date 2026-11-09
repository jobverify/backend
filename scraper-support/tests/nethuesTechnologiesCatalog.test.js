import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadNethuesCatalog = async () => {
  try {
    return await import('../../scraper/nethuestechnologies/catalog.js')
  } catch {
    assert.fail('Expected Nethues Technologies catalog module at ../../scraper/nethuestechnologies/catalog.js')
  }
}

test('Nethues Technologies provider metadata captures the verified inline openings surface', async () => {
  const { NETHUES_TECHNOLOGIES_CATALOG } = await loadNethuesCatalog()
  const provider = hydrateProviderCatalogEntry(NETHUES_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'nethuestechnologies')
  assert.equal(provider.companyName, 'Nethues Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.nethues.com/careers/')
  assert.equal(provider.companyDomain, 'nethues.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-inline-sections')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+openings-list+inline-job-details+first-party-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /nethuestechnologies[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /Full Stack Developer/i)
})

test('Nethues Technologies backlog row matches directly from the local provider metadata', async () => {
  const { NETHUES_TECHNOLOGIES_CATALOG } = await loadNethuesCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Nethues Technologies\n',
    catalog: [hydrateProviderCatalogEntry(NETHUES_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
