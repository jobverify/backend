import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/optisolbusinesssolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/optisolbusinesssolutions/catalog.js')
  } catch {
    assert.fail('Expected OptiSol Business Solutions catalog module at ../../scraper/optisolbusinesssolutions/catalog.js')
  }
}

test('OptiSol Business Solutions local catalog captures the verified first-party Zoho widget contract', async () => {
  const { OPTISOL_BUSINESS_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OPTISOL_BUSINESS_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, OPTISOL_BUSINESS_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'optisolbusinesssolutions')
  assert.equal(provider.companyName, 'OptiSol Business Solutions')
  assert.equal(provider.officialBrandName, 'OptiSol')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.optisolbusiness.com/join-with-us')
  assert.equal(provider.companyCareerPage, 'https://www.optisolbusiness.com/current-openings')
  assert.equal(provider.currentOpeningsUrl, 'https://www.optisolbusiness.com/current-openings')
  assert.equal(provider.careersPortalUrl, 'https://optisolbusiness.zohorecruit.in/jobs/Careers')
  assert.equal(provider.careersApiUrl, 'https://optisolbusiness.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite')
  assert.equal(provider.companyDomain, 'optisolbusiness.com')
  assert.equal(provider.atsPlatform, 'embedded-zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-zohorecruit-api-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-landing+embedded-zohorecruit-widget+public-job-openings-api',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /current-openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Digital Marketing Associate/i)
})

test('OptiSol Business Solutions exact backlog row resolves from the local catalog contract', async () => {
  const { OPTISOL_BUSINESS_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OptiSol Business Solutions\n',
    catalog: [hydrateProviderCatalogEntry(OPTISOL_BUSINESS_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
