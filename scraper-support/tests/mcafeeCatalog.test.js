import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mcafee/script.js')

const loadCatalogModule = async () => import('../../scraper/mcafee/catalog.js')

test('McAfee local catalog captures the verified public Jibe jobs API contract', async () => {
  const { MCAFEE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MCAFEE_CATALOG)

  assert.equal(defaultCatalog, MCAFEE_CATALOG)
  assert.equal(provider.source, 'mcafee')
  assert.equal(provider.companyName, 'McAfee')
  assert.equal(provider.officialBrandName, 'McAfee')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://careers.mcafee.com/join')
  assert.equal(provider.companyCareerPage, 'https://careers.mcafee.com/join')
  assert.equal(provider.jobsPageUrl, 'https://careers.mcafee.com/jobs')
  assert.equal(provider.jobsApiUrl, 'https://careers.mcafee.com/api/jobs')
  assert.equal(provider.searchResultsUrl, 'https://careers.mcafee.com/global/en/search-results')
  assert.equal(provider.companyDomain, 'careers.mcafee.com')
  assert.equal(provider.atsPlatform, 'jibe-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'join-page-plus-jobs-page-plus-jobs-api-country-filter')
  assert.equal(provider.extractionStrategy, 'verified-jibe-join-page+verified-jobs-page+verified-public-jobs-api-country-filter')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.equal(provider.verifiedSampleJobUrl, 'https://careers.mcafee.com/jobs/1469?lang=en-us')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /mcafee[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.mcafee\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /api\/jobs returns 5 India openings/i)
})

test('McAfee exact backlog row resolves from the local provider contract', async () => {
  const { MCAFEE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'McAfee\n',
    catalog: [hydrateProviderCatalogEntry(MCAFEE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['McAfee', 'mcafee', 'McAfee']],
  )
})
