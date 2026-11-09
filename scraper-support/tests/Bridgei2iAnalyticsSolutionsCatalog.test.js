import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bridgei2ianalyticssolutions/script.js')

const REDIRECTED_HOMEPAGE_FIXTURE = `
  <title>Artificial Intelligence (AI) Services &amp; Solutions | Accenture</title>
  <h2>Data careers</h2>
  <a href="/us-en/careers/explore-careers/area-of-interest/ai-data-science-careers?aoi=Artificial%20Intelligence%20(AI)%20%26%20Data%20Science">Search open roles</a>
  <p>© 2026 Accenture. All Rights Reserved.</p>
`

const ACQUISITION_NOTICE_FIXTURE = `
  <title>BRIDGEi2i is now part of Accenture.</title>
  <h1>Accenture Completes Acquisition of BRIDGEi2i</h1>
  <p>Accenture has completed its acquisition of BRIDGEi2i.</p>
  <p>BRIDGEi2i is now part of Accenture.</p>
`

const DEDICATED_JOBS_FIXTURE = `
  <h2>Bridgei2i Careers</h2>
  <a href="/jobs/data-engineer">Apply Now</a>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bridgei2ianalyticssolutions/catalog.js')
  } catch {
    assert.fail('Expected Bridgei2i Analytics Solutions catalog module at ../../scraper/bridgei2ianalyticssolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/bridgei2ianalyticssolutions/script.js')
  } catch {
    assert.fail('Expected Bridgei2i Analytics Solutions scraper module at ../../scraper/bridgei2ianalyticssolutions/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bridgei2i Analytics Solutions local catalog captures the verified acquisition redirect and generic parent-careers handoff', async () => {
  const { BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'bridgei2ianalyticssolutions')
  assert.equal(provider.companyName, 'Bridgei2i Analytics Solutions')
  assert.equal(provider.officialBrandName, 'BRIDGEi2i')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://bridgei2i.com/')
  assert.equal(provider.companyCareerPage, 'https://bridgei2i.com/')
  assert.equal(provider.acquisitionNoticeUrl, 'https://newsroom.accenture.com/news/2021/accenture-completes-acquisition-of-bridgei2i')
  assert.equal(
    provider.linkedParentCareersPage,
    'https://www.accenture.com/us-en/careers/explore-careers/area-of-interest/ai-data-science-careers?aoi=Artificial%20Intelligence%20(AI)%20%26%20Data%20Science',
  )
  assert.equal(provider.companyDomain, 'bridgei2i.com')
  assert.equal(provider.atsPlatform, 'acquired-company-domain-redirect-no-exact-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'redirected-homepage-plus-acquisition-notice')
  assert.equal(
    provider.extractionStrategy,
    'verified-domain-redirect-to-accenture-ai+verified-acquisition-notice+generic-parent-careers-link+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bridgei2i\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/newsroom\.accenture\.com\/news\/2021\/accenture-completes-acquisition-of-bridgei2i/i)
  assert.match(provider.verifiedSurfaceSummary, /Data careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no exact Bridgei2i job board/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /bridgei2ianalyticssolutions[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bridgei2i Analytics Solutions\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Bridgei2i Analytics Solutions scraper stays fail-closed while the domain only shows generic Accenture AI careers messaging', async () => {
  const bridgei2i = await loadScriptModule()
  const scraper = bridgei2i.createBridgei2iAnalyticsSolutionsScraper()

  assert.equal(bridgei2i.hasRedirectedHomepageSignal(REDIRECTED_HOMEPAGE_FIXTURE), true)
  assert.equal(bridgei2i.hasAcquisitionNoticeSignal(ACQUISITION_NOTICE_FIXTURE), true)
  assert.equal(bridgei2i.pageExposesDedicatedBridgei2iJobs(REDIRECTED_HOMEPAGE_FIXTURE), false)
  assert.equal(bridgei2i.pageExposesDedicatedBridgei2iJobs(DEDICATED_JOBS_FIXTURE), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === bridgei2i.HOMEPAGE_URL) return REDIRECTED_HOMEPAGE_FIXTURE
      if (url === bridgei2i.ACQUISITION_NOTICE_URL) return ACQUISITION_NOTICE_FIXTURE
      assert.fail(`Unexpected URL requested by Bridgei2i scraper: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
