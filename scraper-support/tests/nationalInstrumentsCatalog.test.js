import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nationalInstrumentsModulePath = path.resolve(currentDir, '../../scraper/nationalinstruments/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nationalinstruments/catalog.js')
  } catch {
    assert.fail('Expected National Instruments catalog module at ../../scraper/nationalinstruments/catalog.js')
  }
}

const loadNationalInstrumentsModule = async () => {
  try {
    return await import('../../scraper/nationalinstruments/script.js')
  } catch {
    assert.fail('Expected National Instruments scraper module at ../../scraper/nationalinstruments/script.js')
  }
}

test('National Instruments local catalog captures the verified Emerson handoff and NI Oracle company filter', async () => {
  const { NATIONAL_INSTRUMENTS_CATALOG } = await loadCatalogModule()
  const nationalInstruments = await loadNationalInstrumentsModule()

  assert.deepEqual(NATIONAL_INSTRUMENTS_CATALOG, {
    source: 'nationalinstruments',
    companyName: 'National Instruments',
    officialBrandName: 'NI',
    adapter: 'script',
    modulePath: nationalInstrumentsModulePath,
    homepageUrl: 'https://www.ni.com/',
    companyCareerPage: 'https://www.ni.com/en/about-ni/careers.html',
    redirectedCareerPageUrl: 'https://www.emerson.com/en/corporate/careers',
    companyDomain: 'ni.com',
    oracleCandidateExperienceUrl:
      'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs',
    oracleCandidateExperienceRootUrl:
      'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1',
    workspaceDomain: 'hdjq.fa.us2.oraclecloud.com',
    listingApiBaseUrl:
      'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
    detailApiBaseUrl:
      'https://hdjq.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
    publicJobsBaseUrl:
      'https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/',
    siteNumber: 'CX_1',
    countryFilter: 'India',
    targetBusinessUnitId: '300012142648830',
    targetLegalEmployerId: '300012194279570',
    atsPlatform: 'oracle-cloud',
    paginationStrategy: 'offset-query',
    extractionStrategy:
      'verified-ni-careers-redirect+emerson-handoff+oracle-cloud-finder-api+oracle-cloud-detail-api+business-unit-filter',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    verifiedOn: '2026-08-03',
    verifiedSurfaceSummary:
      'Verified on Monday, August 3, 2026 that https://www.ni.com/en/about-ni/careers.html now redirects to the Emerson careers page at https://www.emerson.com/en/corporate/careers, that the Emerson page publicly links candidates into the Oracle Candidate Experience shell at https://hdjq.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/jobs, and that the live India finder exposed eight National Instruments / Test & Measurement roles when filtered to BusinessUnitId 300012142648830 and LegalEmployerId 300012194279570.',
  })

  assert.equal(nationalInstruments.PROVIDER_METADATA.source, NATIONAL_INSTRUMENTS_CATALOG.source)
  assert.equal(
    nationalInstruments.PROVIDER_METADATA.companyCareerPage,
    NATIONAL_INSTRUMENTS_CATALOG.companyCareerPage,
  )
  assert.equal(
    nationalInstruments.PROVIDER_METADATA.oracleCandidateExperienceUrl,
    NATIONAL_INSTRUMENTS_CATALOG.oracleCandidateExperienceUrl,
  )
  assert.equal(
    nationalInstruments.PROVIDER_METADATA.targetBusinessUnitId,
    NATIONAL_INSTRUMENTS_CATALOG.targetBusinessUnitId,
  )
})

test('National Instruments exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { NATIONAL_INSTRUMENTS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'National Instruments\n',
    catalog: [NATIONAL_INSTRUMENTS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['National Instruments', 'nationalinstruments', 'National Instruments']],
  )
})

test('getScraperCatalog includes National Instruments as a verified Emerson Oracle provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'nationalinstruments')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'National Instruments')
  assert.equal(provider.companyCareerPage, 'https://www.ni.com/en/about-ni/careers.html')
  assert.equal(provider.companyDomain, 'ni.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.modulePath, /nationalinstruments[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable National Instruments scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'nationalinstruments')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'nationalinstruments')
  assert.equal(scraper.provider.atsPlatform, 'oracle-cloud')
  assert.match(scraper.dryRunFile, /nationalinstruments[\\/]jobs\.json$/i)
})
