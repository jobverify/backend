import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAciWorldwideIndiaCatalogModule = async () => {
  try {
    return await import('../../scraper/aciworldwideindia/catalog.js')
  } catch {
    assert.fail('Expected ACI Worldwide India catalog module at ../../scraper/aciworldwideindia/catalog.js')
  }
}

test('ACI Worldwide India catalog captures the verified Oracle careers handoff metadata', async () => {
  const aciWorldwideIndiaCatalog = await loadAciWorldwideIndiaCatalogModule()

  assert.deepEqual(aciWorldwideIndiaCatalog.ACI_WORLDWIDE_INDIA_CATALOG, {
    source: 'aciworldwideindia',
    companyName: 'ACI Worldwide India',
    companyCareerPage: 'https://www.aciworldwide.com/about-aci/careers',
    companyDomain: 'aciworldwide.com',
    adapter: 'script',
    atsPlatform: 'oracle-cloud',
    countryFilter: 'India',
    paginationStrategy: 'offset-query',
    extractionStrategy: 'verified-official-careers-pages+oracle-cloud-finder-api+oracle-cloud-detail-api',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    modulePath: 'scraper/aciworldwideindia/script.js',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary:
      'Verified on July 14, 2026 that https://www.aciworldwide.com/about-aci/careers hands off Explore Opportunities to the public Oracle Candidate Experience site at https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/, and the public India finder currently exposes live ACI Worldwide roles in Pune and Bangalore.',
    workspaceDomain: 'ebwg.fa.us2.oraclecloud.com',
    listingApiBaseUrl: 'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    detailApiBaseUrl: 'https://ebwg.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
    publicJobsBaseUrl: 'https://ebwg.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
    siteNumber: 'CX',
  })
})

test('buildScrapers and company coverage resolve ACI Worldwide India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aciworldwideindia')
  const scraper = buildScrapers().find((item) => item.name === 'aciworldwideindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'ACI Worldwide India')
  assert.equal(provider.companyCareerPage, 'https://www.aciworldwide.com/about-aci/careers')
  assert.match(scraper.dryRunFile, /aciworldwideindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'ACI Worldwide India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ACI Worldwide India', 'aciworldwideindia', 'ACI Worldwide India']],
  )
})
