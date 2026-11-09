import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const experianIndiaModulePath = path.resolve(currentDir, '../../scraper/experianindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/experianindia/catalog.js')
  } catch {
    assert.fail('Expected Experian India catalog module at ../../scraper/experianindia/catalog.js')
  }
}

const loadExperianIndiaModule = async () => {
  try {
    return await import('../../scraper/experianindia/script.js')
  } catch {
    assert.fail('Expected Experian India scraper module at ../../scraper/experianindia/script.js')
  }
}

test('Experian India local catalog captures the verified company-owned Attrax jobs surface', async () => {
  const { EXPERIAN_INDIA_CATALOG } = await loadCatalogModule()
  const experianIndia = await loadExperianIndiaModule()

  assert.equal(EXPERIAN_INDIA_CATALOG.source, 'experianindia')
  assert.equal(EXPERIAN_INDIA_CATALOG.companyName, 'Experian India')
  assert.equal(EXPERIAN_INDIA_CATALOG.officialBrandName, 'Experian')
  assert.equal(EXPERIAN_INDIA_CATALOG.adapter, 'script')
  assert.equal(EXPERIAN_INDIA_CATALOG.homepageUrl, 'https://www.experian.com/')
  assert.equal(EXPERIAN_INDIA_CATALOG.globalCareersUrl, 'https://www.experian.com/careers')
  assert.equal(EXPERIAN_INDIA_CATALOG.companyCareerPage, 'https://jobs.experian.com/jobs')
  assert.equal(EXPERIAN_INDIA_CATALOG.jobsPageUrl, 'https://jobs.experian.com/jobs')
  assert.equal(
    EXPERIAN_INDIA_CATALOG.verifiedJobUrl,
    'https://jobs.experian.com/job/product-manager-in-mumbai-india-jid-3726',
  )
  assert.equal(
    EXPERIAN_INDIA_CATALOG.verifiedApplyUrl,
    'https://jobs.experian.com/Workflow?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726',
  )
  assert.equal(EXPERIAN_INDIA_CATALOG.verifiedIndiaLocationFilterId, '422')
  assert.equal(EXPERIAN_INDIA_CATALOG.verifiedIndiaLocationCount, 38)
  assert.equal(EXPERIAN_INDIA_CATALOG.verifiedTotalJobsCount, 369)
  assert.equal(EXPERIAN_INDIA_CATALOG.atsPlatform, 'first-party-attrax')
  assert.equal(EXPERIAN_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(EXPERIAN_INDIA_CATALOG.paginationStrategy, 'first-party-attrax-html-pagination')
  assert.equal(
    EXPERIAN_INDIA_CATALOG.extractionStrategy,
    'verified-company-owned-jobs-page+global-careers-nav-link+india-location-filter+attrax-india-cards+detail-page-workflow-apply',
  )
  assert.equal(EXPERIAN_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(EXPERIAN_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EXPERIAN_INDIA_CATALOG.companyDomain, 'jobs.experian.com')
  assert.equal(EXPERIAN_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.match(EXPERIAN_INDIA_CATALOG.dryRunFile, /experianindia[\\/]jobs\.json$/i)
  assert.equal(EXPERIAN_INDIA_CATALOG.modulePath, experianIndiaModulePath)
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.experian\.com\/jobs\b/i)
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.experian\.com\/jobs\?page=2/i)
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.experian\.com\/careers/i)
  assert.match(
    EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jobs\.experian\.com\/job\/product-manager-in-mumbai-india-jid-3726/i,
  )
  assert.match(
    EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jobs\.experian\.com\/Workflow\?workflowId=f7166936-2678-436a-bdf5-4f3d2a5a9abe&vacancyId=3726/i,
  )
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /\b369 Jobs\b/i)
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /\bIndia filter 422\b/i)
  assert.match(EXPERIAN_INDIA_CATALOG.verifiedSurfaceSummary, /\b38 India roles\b/i)

  assert.equal(experianIndia.PROVIDER_METADATA.source, EXPERIAN_INDIA_CATALOG.source)
  assert.equal(experianIndia.PROVIDER_METADATA.companyName, EXPERIAN_INDIA_CATALOG.companyName)
  assert.equal(experianIndia.PROVIDER_METADATA.jobsPageUrl, EXPERIAN_INDIA_CATALOG.jobsPageUrl)
  assert.equal(
    experianIndia.PROVIDER_METADATA.verifiedIndiaLocationFilterId,
    EXPERIAN_INDIA_CATALOG.verifiedIndiaLocationFilterId,
  )
})

test('Experian India exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { EXPERIAN_INDIA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Experian India\n',
    catalog: [EXPERIAN_INDIA_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Experian India', 'experianindia', 'Experian India']],
  )
})
