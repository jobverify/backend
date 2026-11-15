import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/verintsystems/nativeCareers20261114.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/verintsystems/catalog.js')
  } catch {
    assert.fail('Expected Verint Systems catalog module at ../../scraper/verintsystems/catalog.js')
  }
}

test('Verint Systems current catalog registers own Ashby and retains historical Oracle helper metadata', async () => {
  const { VERINT_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(VERINT_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, VERINT_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'verintsystems')
  assert.equal(provider.companyName, 'Verint Systems')
  assert.equal(provider.officialBrandName, 'Verint')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.verint.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://www.verint.com/careers/')
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  )
  assert.equal(provider.workspaceDomain, 'fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.publicJobsBaseUrl,
    'https://fa-epcb-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  )
  assert.equal(provider.siteNumber, 'CX')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.boardToken, 'verint')
  assert.equal(provider.nativeBoardUrl, 'https://jobs.ashbyhq.com/27cfd344-670f-4dcd-8b13-0e18005b0d65')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'finite-current-native-board-and-public-feed-opening-closing')
  assert.equal(
    provider.extractionStrategy,
    'current-corporate-declared-own-ashby+original-full-native-India-criteria-as-data',
  )
  assert.equal(provider.verifiedOn, '2026-11-14')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Join Our Global Team/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  const registered = getScraperCatalog().find(row => row.source === 'verintsystems')
  for (const key of ['modulePath', 'atsPlatform', 'boardToken', 'nativeBoardUrl', 'sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(registered[key], provider[key])
})

test('Verint Systems exact backlog row resolves from the local catalog contract', async () => {
  const { VERINT_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Verint Systems\n',
    catalog: [hydrateProviderCatalogEntry(VERINT_SYSTEMS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
