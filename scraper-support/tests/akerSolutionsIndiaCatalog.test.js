import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/akersolutionsindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/akersolutionsindia/catalog.js')
  } catch {
    assert.fail('Expected Aker Solutions India catalog module at ../../scraper/akersolutionsindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/akersolutionsindia/script.js')
  } catch {
    assert.fail('Expected Aker Solutions India scraper module at ../../scraper/akersolutionsindia/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Aker Solutions India local catalog captures the verified first-party careers landing and job-search surface', async () => {
  const { AKER_SOLUTIONS_INDIA_CATALOG } = await loadCatalogModule()
  const akerSolutionsIndia = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AKER_SOLUTIONS_INDIA_CATALOG)

  assert.equal(provider.source, 'akersolutionsindia')
  assert.equal(provider.companyName, 'Aker Solutions India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.akersolutions.com/careers/')
  assert.equal(provider.companyDomain, 'akersolutions.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-plus-successfactors-apply-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-landing-plus-embedded-job-search-json',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-landing+embedded-job-list-json+india-detail-pages+successfactors-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://www.akersolutions.com/')
  assert.equal(provider.jobSearchUrl, 'https://www.akersolutions.com/careers/job-search/')
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://www.akersolutions.com/careers/job-search?jobPostId=21793',
  )
  assert.equal(provider.successFactorsApplyHost, 'https://career2.successfactors.eu')
  assert.equal(provider.successFactorsCompanyToken, 'akersoluti')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.akersolutions\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.akersolutions\.com\/careers\/job-search\//i)
  assert.match(provider.verifiedSurfaceSummary, /jobPostId=21793/i)
  assert.match(provider.verifiedSurfaceSummary, /career2\.successfactors\.eu/i)
  assert.match(provider.verifiedSurfaceSummary, /38 vacancies/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /akersolutionsindia[\\/]jobs\.json$/i)

  assert.equal(akerSolutionsIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(akerSolutionsIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(akerSolutionsIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(akerSolutionsIndia.PROVIDER_METADATA.jobSearchUrl, provider.jobSearchUrl)
})

test('Aker Solutions India exact backlog name matches from the local provider contract without aliases', async () => {
  const { AKER_SOLUTIONS_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aker Solutions India\n',
    catalog: [buildCatalogReadyProvider(AKER_SOLUTIONS_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aker Solutions India', 'akersolutionsindia', 'Aker Solutions India']],
  )
})

test('buildScrapers and company coverage resolve Aker Solutions India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akersolutionsindia')
  const scraper = buildScrapers().find((item) => item.name === 'akersolutionsindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aker Solutions India')
  assert.equal(provider.companyCareerPage, 'https://www.akersolutions.com/careers/')
  assert.match(scraper.dryRunFile, /akersolutionsindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aker Solutions India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aker Solutions India', 'akersolutionsindia', 'Aker Solutions India']],
  )
})
