import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/verintsystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/verintsystems/catalog.js')
  } catch {
    assert.fail('Expected Verint Systems catalog module at ../../scraper/verintsystems/catalog.js')
  }
}

test('Verint Systems local catalog captures the verified Oracle Candidate Experience handoff', async () => {
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
  assert.equal(provider.atsPlatform, 'oracle-candidate-experience')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'oracle-finder-location-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+oracle-candidate-experience+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Join Our Global Team/i)
  assert.match(provider.verifiedSurfaceSummary, /Oracle Candidate Experience/i)
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
