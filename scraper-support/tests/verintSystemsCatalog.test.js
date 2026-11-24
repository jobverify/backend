import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/verintsystems/script.js')

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
  assert.equal(provider.paginationStrategy, "paired-current-own-native-board-documented-feed-and-positive-India-role-partials")
  assert.equal(
    provider.extractionStrategy,
    "active-own-Verint-declaration;original-native-board-and-typed-feed-countries;full-same-role-state-schema-criteria-dates-unvisited-application",
  )
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedAt, null)
  assert.equal(provider.scraperTimeoutMs, 180000)
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.backfillMode, 'live-parser')
  assert.equal(provider.authoritativeCurrentPublication, true)
  for (const field of ['verifiedPublicJobCount', 'verifiedGlobalJobCount', 'verifiedIndiaJobCount']) assert.equal(provider[field], null)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedSurfaceSummary, VERINT_SYSTEMS_CATALOG.verifiedSurfaceSummary)
  assert.match(provider.verifiedSurfaceSummary, /Current active Verint careers anchors declare the native board/i)
  assert.match(provider.verifiedSurfaceSummary, /Only positive partials may qualify/i)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  const registered = getScraperCatalog().find(row => row.source === 'verintsystems')
  assert.equal(registered.scraperTimeoutMs, 190000)
  assert.equal(registered.currentProgrammeZeroProfile, null)
  assert.equal(registered.verifiedOn, null)
  assert.equal(registered.verifiedAt, null)
  for (const field of ['verifiedPublicJobCount', 'verifiedGlobalJobCount', 'verifiedIndiaJobCount']) assert.equal(registered[field], null)
  for (const key of ['paginationStrategy', 'extractionStrategy', 'parser', 'backfillMode', 'authoritativeCurrentPublication', 'verifiedSurfaceSummary']) assert.equal(registered[key], provider[key])
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
