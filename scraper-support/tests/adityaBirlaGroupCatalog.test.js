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
const modulePath = path.resolve(currentDir, '../../scraper/adityabirlagroup/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/adityabirlagroup/catalog.js')
  } catch {
    assert.fail('Expected Aditya Birla Group catalog module at ../../scraper/adityabirlagroup/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/adityabirlagroup/script.js')
  } catch {
    assert.fail('Expected Aditya Birla Group scraper module at ../../scraper/adityabirlagroup/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Aditya Birla Group local catalog captures the verified first-party public careers surface', async () => {
  const { ADITYA_BIRLA_GROUP_CATALOG } = await loadCatalogModule()
  const adityaBirlaGroup = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ADITYA_BIRLA_GROUP_CATALOG)

  assert.equal(provider.source, 'adityabirlagroup')
  assert.equal(provider.companyName, 'Aditya Birla Group')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.adityabirla.com/')
  assert.equal(provider.companyDomain, 'adityabirla.com')
  assert.equal(provider.atsPlatform, 'official-aditya-birla-native-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'native-page-index-pagination-with-organisation-counts-terminal-page-and-closing-comparison')
  assert.equal(
    provider.extractionStrategy,
    'public-page-token+unfiltered-group-api+native-full-detail-model+explicit-country-hierarchy+full-criteria+retained-unqualified-observations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://www.adityabirla.com/')
  assert.equal(provider.jobSearchUrl, 'https://careers.adityabirla.com/job-search')
  assert.equal(provider.uploadCvUrl, 'https://abgcareers.peoplestrong.com/register')
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.adityabirla\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.adityabirla\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.adityabirla\.com\/job-search/i)
  assert.match(provider.verifiedSurfaceSummary, /runtime/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /adityabirlagroup[\\/]jobs\.json$/i)

  assert.equal(adityaBirlaGroup.PROVIDER_METADATA.source, provider.source)
  assert.equal(adityaBirlaGroup.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    adityaBirlaGroup.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(adityaBirlaGroup.PROVIDER_METADATA.jobSearchUrl, provider.jobSearchUrl)
  assert.equal(adityaBirlaGroup.PROVIDER_METADATA.uploadCvUrl, provider.uploadCvUrl)
})

test('Aditya Birla Group exact backlog name matches from the local provider contract without aliases', async () => {
  const { ADITYA_BIRLA_GROUP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aditya Birla Group\n',
    catalog: [buildCatalogReadyProvider(ADITYA_BIRLA_GROUP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aditya Birla Group', 'adityabirlagroup', 'Aditya Birla Group']],
  )
})

test('buildScrapers and company coverage resolve Aditya Birla Group from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'adityabirlagroup')
  const scraper = buildScrapers().find((item) => item.name === 'adityabirlagroup')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.atsPlatform, 'official-aditya-birla-native-api')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.companyName, 'Aditya Birla Group')
  assert.equal(provider.companyCareerPage, 'https://careers.adityabirla.com/')
  assert.match(scraper.dryRunFile, /adityabirlagroup[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aditya Birla Group\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aditya Birla Group', 'adityabirlagroup', 'Aditya Birla Group']],
  )
})
