import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const bainCompanyModulePath = path.resolve(currentDir, '../../scraper/baincompany/script.js')

const VERIFIED_INDIA_OFFICES = ['Bengaluru', 'Mumbai', 'New Delhi']

const loadBainCompanyCatalog = async () => {
  try {
    return await import('../../scraper/baincompany/catalog.js')
  } catch {
    assert.fail('Expected Bain & Company catalog module at ../../scraper/baincompany/catalog.js')
  }
}

const loadBainCompanyModule = async () => {
  try {
    return await import('../../scraper/baincompany/script.js')
  } catch {
    assert.fail('Expected Bain & Company scraper module at ../../scraper/baincompany/script.js')
  }
}

test('Bain & Company local catalog captures the verified first-party careers pages, API, and India-office job surface', async () => {
  const { BAIN_COMPANY_CATALOG } = await loadBainCompanyCatalog()
  const bainCompany = await loadBainCompanyModule()

  assert.equal(BAIN_COMPANY_CATALOG.source, 'baincompany')
  assert.equal(BAIN_COMPANY_CATALOG.companyName, 'Bain & Company')
  assert.equal(BAIN_COMPANY_CATALOG.officialBrandName, 'Bain & Company, Inc.')
  assert.equal(BAIN_COMPANY_CATALOG.adapter, 'script')
  assert.equal(BAIN_COMPANY_CATALOG.homepageUrl, 'https://www.bain.com/')
  assert.equal(BAIN_COMPANY_CATALOG.careersHomeUrl, 'https://www.bain.com/careers/')
  assert.equal(BAIN_COMPANY_CATALOG.companyCareerPage, 'https://www.bain.com/careers/find-a-role/')
  assert.equal(
    BAIN_COMPANY_CATALOG.jobSearchApiUrl,
    'https://www.bain.com/en/api/jobsearch/keyword/get',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.allRolesApiUrl,
    'https://www.bain.com/en/api/jobsearch/keyword/get?start=0&results=500&filters=&searchValue=',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.positionApplyBaseUrl,
    'https://careers.bain.com/jobs/Login?folderId=',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.verifiedSamplePositionUrl,
    'https://www.bain.com/careers/find-a-role/position/?jobid=105837',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.verifiedSampleApplyUrl,
    'https://careers.bain.com/jobs/Login?folderId=105837',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.verifiedSampleProgramUrl,
    'https://www.bain.com/careers/work-with-us/internships-programs/associate-consultant-internship/',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.verifiedSampleProgramApplyUrl,
    'https://careers.bain.com/recruits/signin?folderId=10403',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.verifiedScholarshipUrl,
    'https://www.bain.com/careers/work-with-us/internships-programs/true-north-scholarship-for-women-india/',
  )
  assert.deepEqual(BAIN_COMPANY_CATALOG.verifiedIndiaOffices, VERIFIED_INDIA_OFFICES)
  assert.equal(BAIN_COMPANY_CATALOG.verifiedIndiaJobCount, 76)
  assert.equal(BAIN_COMPANY_CATALOG.companyDomain, 'bain.com')
  assert.equal(BAIN_COMPANY_CATALOG.atsPlatform, 'first-party-jobsearch-api')
  assert.equal(BAIN_COMPANY_CATALOG.countryFilter, 'India')
  assert.equal(
    BAIN_COMPANY_CATALOG.paginationStrategy,
    'single-first-party-jobsearch-api-request-up-to-500-results',
  )
  assert.equal(
    BAIN_COMPANY_CATALOG.extractionStrategy,
    'verified-careers-home+verified-find-a-role-shell+verified-first-party-jobsearch-api+india-office-filter+position-apply-handoff',
  )
  assert.equal(BAIN_COMPANY_CATALOG.parser, 'custom-script')
  assert.equal(BAIN_COMPANY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(BAIN_COMPANY_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(BAIN_COMPANY_CATALOG.dryRunFile, 'baincompany/jobs.json')
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.bain\.com\/careers\//i)
  assert.match(
    BAIN_COMPANY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.bain\.com\/careers\/find-a-role\//i,
  )
  assert.match(
    BAIN_COMPANY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.bain\.com\/en\/api\/jobsearch\/keyword\/get\?start=0&results=500&filters=&searchValue=/i,
  )
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /253 public roles/i)
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /76 India-facing roles/i)
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /Bengaluru, Mumbai, or New Delhi/i)
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /jobid=105837/i)
  assert.match(BAIN_COMPANY_CATALOG.verifiedSurfaceSummary, /folderId=10403/i)
  assert.equal(BAIN_COMPANY_CATALOG.modulePath, bainCompanyModulePath)

  assert.equal(bainCompany.PROVIDER_METADATA.source, BAIN_COMPANY_CATALOG.source)
  assert.equal(bainCompany.PROVIDER_METADATA.companyName, BAIN_COMPANY_CATALOG.companyName)
  assert.deepEqual(bainCompany.VERIFIED_INDIA_OFFICES, VERIFIED_INDIA_OFFICES)
})

test('Bain & Company backlog row hydrates locally and does not require a shared alias entry', async () => {
  const { BAIN_COMPANY_CATALOG } = await loadBainCompanyCatalog()
  const provider = hydrateProviderCatalogEntry(BAIN_COMPANY_CATALOG)

  assert.equal(provider.companyName, 'Bain & Company')
  assert.equal(provider.companyDomain, 'bain.com')
  assert.match(provider.modulePath, /baincompany[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /baincompany[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bain & Company'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Bain & Company\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bain & Company', 'baincompany', 'Bain & Company']],
  )
})

test('buildScrapers and company coverage resolve Bain & Company from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'baincompany')
  const scraper = buildScrapers().find((item) => item.name === 'baincompany')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Bain & Company')
  assert.equal(provider.companyCareerPage, 'https://www.bain.com/careers/find-a-role/')
  assert.match(scraper.dryRunFile, /baincompany[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bain & Company\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bain & Company', 'baincompany', 'Bain & Company']],
  )
})
