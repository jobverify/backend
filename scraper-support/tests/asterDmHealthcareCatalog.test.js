import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/asterdmhealthcare/catalog.js')
  } catch {
    assert.fail('Expected Aster DM Healthcare catalog module at ../../scraper/asterdmhealthcare/catalog.js')
  }
}

test('Aster DM Healthcare local catalog captures the verified first-party careers handoff to Oracle Cloud', async () => {
  const { ASTER_DM_HEALTHCARE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ASTER_DM_HEALTHCARE_CATALOG)

  assert.equal(provider.source, 'asterdmhealthcare')
  assert.equal(provider.companyName, 'Aster DM Healthcare')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.asterqualitycare.com/careers')
  assert.equal(provider.homepageUrl, 'https://www.asterqualitycare.com/')
  assert.equal(provider.companyDomain, 'asterqualitycare.com')
  assert.equal(provider.legacyHomepageUrl, 'https://www.asterdmhealthcare.in/')
  assert.equal(provider.legacyCareersUrl, 'https://www.asterdmhealthcare.in/careers')
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX',
  )
  assert.equal(provider.workspaceDomain, 'hcdt.fa.us2.oraclecloud.com')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://hcdt.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.publicJobsBaseUrl,
    'https://hcdt.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX/job/',
  )
  assert.equal(provider.siteNumber, 'CX')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'none')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-intake',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.modulePath, /asterdmhealthcare[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /asterdmhealthcare[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.asterqualitycare\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/hcdt\.fa\.us2\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /2430 roles/i)
  assert.match(provider.verifiedSurfaceSummary, /no public job listings or Oracle handoff/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aster DM Healthcare'), false)
})

test('Aster DM Healthcare backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { ASTER_DM_HEALTHCARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aster DM Healthcare\n',
    catalog: [hydrateProviderCatalogEntry(ASTER_DM_HEALTHCARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aster DM Healthcare', 'asterdmhealthcare', 'Aster DM Healthcare']],
  )
})

test('buildScrapers and company coverage resolve Aster DM Healthcare from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'asterdmhealthcare')
  const scraper = buildScrapers().find((item) => item.name === 'asterdmhealthcare')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aster DM Healthcare')
  assert.equal(provider.companyCareerPage, 'https://www.asterqualitycare.com/careers')
  assert.equal(provider.scraperTimeoutMs, 600000)
  assert.match(scraper.dryRunFile, /asterdmhealthcare[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aster DM Healthcare\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aster DM Healthcare', 'asterdmhealthcare', 'Aster DM Healthcare']],
  )
})
