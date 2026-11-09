import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lenskart/catalog.js')
  } catch {
    assert.fail('Expected Lenskart catalog module at ../../scraper/lenskart/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/lenskart/script.js')
  } catch {
    assert.fail('Expected Lenskart scraper module at ../../scraper/lenskart/script.js')
  }
}

test('Lenskart local catalog captures the verified official board handoff and jobs API', async () => {
  const { LENSKART_CATALOG } = await loadCatalogModule()
  const lenskart = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LENSKART_CATALOG)

  assert.equal(provider.source, 'lenskart')
  assert.equal(provider.companyName, 'Lenskart')
  assert.equal(provider.officialBrandName, 'Lenskart')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.lenskart.com/')
  assert.equal(provider.boardSlug, 'lenskart_ho')
  assert.equal(provider.jobsApiUrl, 'https://ainterviews.com/api/job_board/lenskart_ho/jobs/')
  assert.equal(provider.companyDomain, 'lenskart.com')
  assert.equal(provider.atsPlatform, 'ainterviews-job-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 45)
  assert.equal(provider.verifiedSampleJobTitle, 'Product Manager')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-subdomain-handoff-plus-ainterviews-jobs-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-lenskart-board-html+board-slug+jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.lenskart\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ainterviews\.com\/api\/job_board\/lenskart_ho\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /45 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager/i)
  assert.match(provider.modulePath, /lenskart[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lenskart[\\/]jobs\.json$/i)

  assert.equal(lenskart.PROVIDER_METADATA.source, provider.source)
  assert.equal(lenskart.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(lenskart.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(lenskart.PROVIDER_METADATA.jobsApiUrl, provider.jobsApiUrl)
})

test('Lenskart exact backlog row matches from the local provider contract without aliases', async () => {
  const { LENSKART_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Lenskart\n',
    catalog: [hydrateProviderCatalogEntry(LENSKART_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lenskart', 'lenskart', 'Lenskart']],
  )
})
