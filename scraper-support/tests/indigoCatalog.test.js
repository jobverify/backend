import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/indigo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indigo/catalog.js')
  } catch {
    assert.fail('Expected Indigo catalog module at ../../scraper/indigo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/indigo/script.js')
  } catch {
    assert.fail('Expected Indigo scraper module at ../../scraper/indigo/script.js')
  }
}

test('Indigo local catalog captures the verified first-party careers shell and public SuccessFactors API handoff', async () => {
  const { INDIGO_CATALOG } = await loadCatalogModule()
  const indigo = await loadScraperModule()

  assert.equal(INDIGO_CATALOG.source, 'indigo')
  assert.equal(INDIGO_CATALOG.companyName, 'Indigo')
  assert.equal(INDIGO_CATALOG.officialBrandName, 'IndiGo')
  assert.equal(INDIGO_CATALOG.adapter, 'script')
  assert.equal(INDIGO_CATALOG.homepageUrl, 'https://www.goindigo.in/')
  assert.equal(INDIGO_CATALOG.companyCareerPage, 'https://www.goindigo.in/careers.html')
  assert.equal(INDIGO_CATALOG.careersDepartmentsUrl, 'https://www.goindigo.in/careers/departments.html')
  assert.equal(INDIGO_CATALOG.careersJobSearchUrl, 'https://www.goindigo.in/careers/job-search.html')
  assert.equal(
    INDIGO_CATALOG.sampleDepartmentUrl,
    'https://www.goindigo.in/careers/departments/airportoperationscustomerservices.html',
  )
  assert.equal(INDIGO_CATALOG.jobSearchApiUrl, 'https://ms-careers-prod.goindigo.in/career-job-list')
  assert.equal(INDIGO_CATALOG.careerMsUserKey, '03ba3c0795ce04ed48e7fe3854155a1f')
  assert.equal(
    INDIGO_CATALOG.successFactorsApplyUrlPrefix,
    'https://career-in10.hr.cloud.sap/careers?company=interglobe&correlation_Id=38774994&lang=en_GB&clientId=jobs2web&socialApply=false&career_ns=job_application&site=&career_job_req_id=',
  )
  assert.equal(INDIGO_CATALOG.companyDomain, 'goindigo.in')
  assert.equal(INDIGO_CATALOG.atsPlatform, 'official-company-careers-successfactors-api')
  assert.equal(INDIGO_CATALOG.countryFilter, 'India')
  assert.equal(
    INDIGO_CATALOG.paginationStrategy,
    'first-party-job-search-shell-plus-successfactors-api',
  )
  assert.equal(
    INDIGO_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+job-search-env+successfactors-api+india-filter',
  )
  assert.equal(INDIGO_CATALOG.parser, 'custom-script')
  assert.equal(INDIGO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDIGO_CATALOG.verifiedOn, '2026-07-19')
  assert.match(INDIGO_CATALOG.dryRunFile, /indigo[\\/]jobs\.json$/i)
  assert.equal(INDIGO_CATALOG.modulePath, modulePath)
  assert.match(INDIGO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.goindigo\.in\/careers\.html/i)
  assert.match(INDIGO_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.goindigo\.in\/careers\/job-search\.html/i)
  assert.match(INDIGO_CATALOG.verifiedSurfaceSummary, /ms-careers-prod\.goindigo\.in\/career-job-list/i)
  assert.match(INDIGO_CATALOG.verifiedSurfaceSummary, /17 public postings/i)

  assert.equal(indigo.PROVIDER_METADATA.source, INDIGO_CATALOG.source)
  assert.equal(indigo.PROVIDER_METADATA.companyName, INDIGO_CATALOG.companyName)
  assert.equal(indigo.PROVIDER_METADATA.companyCareerPage, INDIGO_CATALOG.companyCareerPage)
  assert.equal(indigo.PROVIDER_METADATA.jobSearchApiUrl, INDIGO_CATALOG.jobSearchApiUrl)
})

test('Indigo exact backlog name matches from the local provider contract without aliases', async () => {
  const { INDIGO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Indigo\n',
    catalog: [INDIGO_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Indigo', 'indigo', 'Indigo']],
  )
})

test('getScraperCatalog includes Indigo as a verified public SuccessFactors API provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indigo')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IndiGo')
  assert.equal(provider.companyCareerPage, 'https://www.goindigo.in/careers.html')
  assert.equal(provider.companyDomain, 'goindigo.in')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.jobsBoardUrl, 'https://www.goindigo.in/careers/job-search.html')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedAt, null)
  assert.equal(provider.jobSearchApiUrl, 'https://ms-careers-prod.goindigo.in/career-job-list')
  assert.match(provider.modulePath, /indigo[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Indigo scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indigo')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indigo')
  assert.equal(scraper.provider.atsPlatform, 'successfactors')
  assert.match(scraper.dryRunFile, /indigo[\\/]jobs\.json$/i)
})
