import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/aigbusinesssolution/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aigbusinesssolution/catalog.js')
  } catch {
    assert.fail('Expected AIG Business Solution catalog module at ../../scraper/aigbusinesssolution/catalog.js')
  }
}

test('AIG Business Solution local catalog captures the verified first-party openings surface', async () => {
  const { AIG_BUSINESS_SOLUTION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AIG_BUSINESS_SOLUTION_CATALOG)

  assert.equal(defaultCatalog, AIG_BUSINESS_SOLUTION_CATALOG)
  assert.equal(provider.source, 'aigbusinesssolution')
  assert.equal(provider.companyName, 'AIG Business Solution')
  assert.equal(provider.officialBrandName, 'AIG Healthcare')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://aighealthcare.in/careers')
  assert.equal(provider.companyCareerPage, 'https://aighealthcare.in/openings')
  assert.equal(provider.companyDomain, 'aighealthcare.in')
  assert.equal(provider.officialJobsHandoffUrl, 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001')
  assert.equal(provider.oracleCandidateExperienceUrl, 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001')
  assert.equal(provider.workspaceDomain, 'eiyi.fa.ap1.oraclecloud.com')
  assert.equal(provider.listingApiBaseUrl, 'https://eiyi.fa.ap1.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions')
  assert.equal(provider.publicJobsBaseUrl, 'https://eiyi.fa.ap1.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/')
  assert.equal(provider.siteNumber, 'CX_3001')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'oracle-finder-api-offset-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+verified-openings-page+oracle-candidate-experience+finder-api',
  )
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Oracle Candidate Experience/i)
  assert.match(provider.verifiedSurfaceSummary, /IKS Health/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst/i)
})

test('AIG Business Solution exact backlog row resolves from the local catalog contract', async () => {
  const { AIG_BUSINESS_SOLUTION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AIG Business Solution\n',
    catalog: [hydrateProviderCatalogEntry(AIG_BUSINESS_SOLUTION_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AIG Business Solution', 'aigbusinesssolution', 'AIG Business Solution']],
  )
})
