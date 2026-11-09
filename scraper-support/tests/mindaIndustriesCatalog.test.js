import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mindaindustries/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mindaindustries/catalog.js')
  } catch {
    assert.fail('Expected Minda Industries catalog module at ../../scraper/mindaindustries/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mindaindustries/script.js')
  } catch {
    assert.fail('Expected Minda Industries scraper module at ../../scraper/mindaindustries/script.js')
  }
}

test('Minda Industries local catalog captures the verified Uno Minda Darwinbox listing contract', async () => {
  const { MINDA_INDUSTRIES_CATALOG } = await loadCatalogModule()
  const mindaIndustries = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MINDA_INDUSTRIES_CATALOG)

  assert.equal(MINDA_INDUSTRIES_CATALOG.source, 'mindaindustries')
  assert.equal(MINDA_INDUSTRIES_CATALOG.companyName, 'Minda Industries')
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.officialBrandName,
    'Uno Minda Limited (formerly Minda Industries Limited)',
  )
  assert.equal(MINDA_INDUSTRIES_CATALOG.adapter, 'script')
  assert.equal(MINDA_INDUSTRIES_CATALOG.modulePath, modulePath)
  assert.equal(MINDA_INDUSTRIES_CATALOG.dryRunFile, 'mindaindustries/jobs.json')
  assert.equal(MINDA_INDUSTRIES_CATALOG.companyCareerPage, 'https://www.unominda.com/career')
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.officialCareersHandoffUrl,
    'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.publicAllJobsUrl,
    'https://inspire-unominda.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.listingApiUrl,
    'https://inspire-unominda.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(MINDA_INDUSTRIES_CATALOG.darwinboxOrigin, 'https://inspire-unominda.darwinbox.in')
  assert.equal(MINDA_INDUSTRIES_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(MINDA_INDUSTRIES_CATALOG.companyDomain, 'unominda.com')
  assert.equal(MINDA_INDUSTRIES_CATALOG.verifiedApplicationContact, 'corphr@unominda.com')
  assert.equal(MINDA_INDUSTRIES_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(MINDA_INDUSTRIES_CATALOG.countryFilter, 'India')
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.paginationStrategy,
    'verified-careers-page-plus-darwinbox-post-listing-api',
  )
  assert.equal(
    MINDA_INDUSTRIES_CATALOG.extractionStrategy,
    'verified-rename-era-careers-page+darwinbox-post-listing-api',
  )
  assert.equal(MINDA_INDUSTRIES_CATALOG.parser, 'custom-script')
  assert.equal(MINDA_INDUSTRIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(MINDA_INDUSTRIES_CATALOG.verifiedOn, '2026-07-19')
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.unominda\.com\/career/i)
  assert.match(
    MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary,
    /formerly known as Minda Industries Limited/i,
  )
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /corphr@unominda\.com/i)
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /HTTP 422/i)
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /POST/i)
  assert.match(MINDA_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /job_counts 58/i)

  assert.equal(provider.source, 'mindaindustries')
  assert.equal(provider.companyName, 'Minda Industries')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.unominda.com/career')
  assert.equal(provider.companyDomain, 'unominda.com')
  assert.match(provider.modulePath, /mindaindustries[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mindaindustries[\\/]jobs\.json$/i)

  assert.equal(mindaIndustries.PROVIDER_METADATA.source, provider.source)
  assert.equal(mindaIndustries.CAREERS_URL, provider.companyCareerPage)
  assert.equal(mindaIndustries.DARWINBOX_ORIGIN, provider.darwinboxOrigin)
  assert.equal(mindaIndustries.DARWINBOX_COMPANY_ID, provider.darwinboxCompanyId)
  assert.equal(mindaIndustries.PUBLIC_LISTING_API_URL, provider.listingApiUrl)
})

test('Minda Industries exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { MINDA_INDUSTRIES_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Minda Industries\n',
    catalog: [hydrateProviderCatalogEntry(MINDA_INDUSTRIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Minda Industries', 'mindaindustries', 'Minda Industries']],
  )
})
