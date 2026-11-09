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
const anaptyssModulePath = path.resolve(currentDir, '../../scraper/anaptyss/script.js')

const VERIFIED_JOB_DETAIL_URLS = [
  'https://www.anaptyss.com/job-post/quality-analyst-qa/',
  'https://www.anaptyss.com/job-post/risk-lines-of-defense-professionals/',
  'https://www.anaptyss.com/job-post/assistant-manager-banking-backend-operations/',
  'https://www.anaptyss.com/job-post/solution-consulting-lead/',
  'https://www.anaptyss.com/job-post/senior-data-architect-modeling-specialist/',
  'https://www.anaptyss.com/job-post/alteryx-designer-server-admin/',
  'https://www.anaptyss.com/job-post/senior-analyst-advisory-professional-services-bfsi/',
  'https://www.anaptyss.com/job-post/full-stack-developer-microsoft-azure-technology/',
]

const loadAnaptyssCatalog = async () => {
  try {
    return await import('../../scraper/anaptyss/catalog.js')
  } catch {
    assert.fail('Expected Anaptyss catalog module at ../../scraper/anaptyss/catalog.js')
  }
}

const loadAnaptyssModule = async () => {
  try {
    return await import('../../scraper/anaptyss/script.js')
  } catch {
    assert.fail('Expected Anaptyss scraper module at ../../scraper/anaptyss/script.js')
  }
}

test('Anaptyss local catalog captures the verified first-party homepage, careers landing, jobs page, and detail URLs', async () => {
  const { ANAPTYSS_CATALOG } = await loadAnaptyssCatalog()
  const anaptyss = await loadAnaptyssModule()

  assert.equal(ANAPTYSS_CATALOG.source, 'anaptyss')
  assert.equal(ANAPTYSS_CATALOG.companyName, 'Anaptyss')
  assert.equal(ANAPTYSS_CATALOG.officialBrandName, 'Anaptyss Inc.')
  assert.equal(ANAPTYSS_CATALOG.adapter, 'script')
  assert.equal(ANAPTYSS_CATALOG.homepageUrl, 'https://www.anaptyss.com/')
  assert.equal(ANAPTYSS_CATALOG.careersLandingUrl, 'https://www.anaptyss.com/careers/')
  assert.equal(ANAPTYSS_CATALOG.companyCareerPage, 'https://www.anaptyss.com/careers/openings')
  assert.equal(ANAPTYSS_CATALOG.legacyJobsUrl, 'https://www.anaptyss.com/jobs/')
  assert.equal(ANAPTYSS_CATALOG.sitemapUrl, 'https://www.anaptyss.com/sitemap_index.xml')
  assert.equal(ANAPTYSS_CATALOG.jobPostSitemapUrl, 'https://www.anaptyss.com/job_post-sitemap.xml')
  assert.equal(ANAPTYSS_CATALOG.sharedApplyPageUrl, 'https://www.anaptyss.com/apply-now/')
  assert.deepEqual(ANAPTYSS_CATALOG.jobDetailUrls, VERIFIED_JOB_DETAIL_URLS)
  assert.equal(ANAPTYSS_CATALOG.companyDomain, 'anaptyss.com')
  assert.equal(ANAPTYSS_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(ANAPTYSS_CATALOG.countryFilter, 'India')
  assert.equal(
    ANAPTYSS_CATALOG.paginationStrategy,
    'current-first-party-openings-list-and-detail-pages-with-legacy-sitemap-fallback',
  )
  assert.equal(
    ANAPTYSS_CATALOG.extractionStrategy,
    'verified-current-homepage+current-openings-list+india-detail-pages+shared-first-party-apply-form',
  )
  assert.equal(ANAPTYSS_CATALOG.parser, 'custom-script')
  assert.equal(ANAPTYSS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ANAPTYSS_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(ANAPTYSS_CATALOG.dryRunFile, 'anaptyss/jobs.json')
  assert.match(ANAPTYSS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.anaptyss\.com\/careers\//i)
  assert.match(ANAPTYSS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.anaptyss\.com\/jobs\//i)
  assert.match(ANAPTYSS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.anaptyss\.com\/job_post-sitemap\.xml/i)
  assert.match(
    ANAPTYSS_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.anaptyss\.com\/job-post\/quality-analyst-qa\//i,
  )
  assert.match(
    ANAPTYSS_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.anaptyss\.com\/job-post\/full-stack-developer-microsoft-azure-technology\//i,
  )
  assert.equal(ANAPTYSS_CATALOG.modulePath, anaptyssModulePath)

  assert.equal(anaptyss.PROVIDER_METADATA.source, ANAPTYSS_CATALOG.source)
  assert.equal(anaptyss.PROVIDER_METADATA.companyName, ANAPTYSS_CATALOG.companyName)
  assert.deepEqual(anaptyss.PROVIDER_METADATA.jobDetailUrls, ANAPTYSS_CATALOG.jobDetailUrls)
})

test('Anaptyss backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ANAPTYSS_CATALOG } = await loadAnaptyssCatalog()
  const provider = hydrateProviderCatalogEntry(ANAPTYSS_CATALOG)

  assert.equal(provider.companyName, 'Anaptyss')
  assert.equal(provider.companyDomain, 'anaptyss.com')
  assert.match(provider.modulePath, /anaptyss[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /anaptyss[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Anaptyss'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Anaptyss\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anaptyss', 'anaptyss', 'Anaptyss']],
  )
})

test('buildScrapers and company coverage resolve Anaptyss from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anaptyss')
  const scraper = buildScrapers().find((item) => item.name === 'anaptyss')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Anaptyss')
  assert.equal(provider.companyCareerPage, 'https://www.anaptyss.com/careers/openings')
  assert.match(scraper.dryRunFile, /anaptyss[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anaptyss\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anaptyss', 'anaptyss', 'Anaptyss']],
  )
})
