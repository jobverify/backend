import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/solvermindssolutionsandtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/solvermindssolutionsandtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Solverminds Solutions and Technologies catalog module at ../../scraper/solvermindssolutionsandtechnologies/catalog.js')
  }
}

test('Solverminds Solutions and Technologies local catalog captures the verified public Zoho careers contract', async () => {
  const { SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'solvermindssolutionsandtechnologies')
  assert.equal(provider.companyName, 'Solverminds Solutions and Technologies')
  assert.equal(provider.officialBrandName, 'Solverminds Solutions & Technologies Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.solverminds.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.solverminds.com/jobs/Careers')
  assert.equal(provider.aboutPageUrl, 'https://www.solverminds.com/about')
  assert.equal(
    provider.careersApiUrl,
    'https://careers.solverminds.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.companyDomain, 'solverminds.com')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-about-page-handoff-plus-public-zoho-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page-handoff+verified-zohorecruit-portal+public-job-openings-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /solvermindssolutionsandtechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.solverminds\.com\/jobs\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /public jobs API/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Software Engineer/i)
})

test('Solverminds Solutions and Technologies exact backlog row resolves from the local provider contract', async () => {
  const { SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Solverminds Solutions and Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SOLVERMINDS_SOLUTIONS_AND_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Solverminds Solutions and Technologies', 'solvermindssolutionsandtechnologies', 'Solverminds Solutions and Technologies']],
  )
})
