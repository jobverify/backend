import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadExcelsoftCatalog = async () => {
  try {
    return await import('../../scraper/excelsofttechnologies/catalog.js')
  } catch {
    assert.fail('Expected Excelsoft Technologies catalog module at ../../scraper/excelsofttechnologies/catalog.js')
  }
}

test('Excelsoft Technologies provider metadata captures the verified no-public-openings careers landing page', async () => {
  const { EXCELSOFT_TECHNOLOGIES_CATALOG } = await loadExcelsoftCatalog()
  const provider = hydrateProviderCatalogEntry(EXCELSOFT_TECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'excelsofttechnologies')
  assert.equal(provider.companyName, 'ExcelSoft Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.excelsoftcorp.com/career/')
  assert.equal(provider.companyDomain, 'excelsoftcorp.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-landing-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing-page+no-public-openings-return-empty',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.modulePath, /excelsofttechnologies[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /One Team One Dream/i)
  assert.match(provider.verifiedSurfaceSummary, /No current Openings/i)
})

test('Excelsoft Technologies backlog row matches directly from the local provider metadata', async () => {
  const { EXCELSOFT_TECHNOLOGIES_CATALOG } = await loadExcelsoftCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'ExcelSoft Technologies\n',
    catalog: [hydrateProviderCatalogEntry(EXCELSOFT_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
