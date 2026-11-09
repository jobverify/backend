import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nagarro/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nagarro/catalog.js')
  } catch {
    assert.fail('Expected Nagarro catalog module at ../../scraper/nagarro/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/nagarro/script.js')
  } catch {
    assert.fail('Expected Nagarro scraper module at ../../scraper/nagarro/script.js')
  }
}

test('Nagarro local catalog captures the verified first-party careers pages and SmartRecruiters ATS wiring', async () => {
  const { NAGARRO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const nagarro = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NAGARRO_CATALOG)

  assert.equal(defaultCatalog, NAGARRO_CATALOG)
  assert.equal(provider.source, 'nagarro')
  assert.equal(provider.companyName, 'Nagarro')
  assert.equal(provider.officialBrandName, 'Nagarro')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nagarro.com/en/careers')
  assert.equal(provider.companyCareerPage, 'https://www.nagarro.com/en/careers/job-search')
  assert.equal(provider.careersLandingPageUrl, 'https://www.nagarro.com/en/careers')
  assert.equal(provider.smartRecruitersBoardUrl, 'https://careers.smartrecruiters.com/Nagarro1')
  assert.equal(
    provider.smartRecruitersListingApiUrl,
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings',
  )
  assert.equal(
    provider.smartRecruitersDetailApiUrlTemplate,
    'https://api.smartrecruiters.com/v1/companies/Nagarro1/postings/{{jobId}}',
  )
  assert.equal(provider.companyDomain, 'nagarro.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-pages-plus-smartrecruiters-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-pages+smartrecruiters-jobs-api+detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /nagarro[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nagarro\.com\/en\/careers\b/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nagarro\.com\/en\/careers\/job-search/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.smartrecruiters\.com\/Nagarro1/i)
  assert.match(provider.verifiedSurfaceSummary, /api\.smartrecruiters\.com\/v1\/companies\/Nagarro1\/postings/i)
  assert.match(provider.verifiedSurfaceSummary, /India postings/i)

  assert.equal(nagarro.PROVIDER_METADATA.source, NAGARRO_CATALOG.source)
  assert.equal(nagarro.PROVIDER_METADATA.companyName, NAGARRO_CATALOG.companyName)
  assert.equal(nagarro.PROVIDER_METADATA.companyCareerPage, NAGARRO_CATALOG.companyCareerPage)
})

test('Nagarro exact backlog name matches directly from local provider metadata', async () => {
  const { NAGARRO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nagarro\n',
    catalog: [hydrateProviderCatalogEntry(NAGARRO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nagarro', 'nagarro', 'Nagarro']],
  )
})

test('Nagarro hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NAGARRO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NAGARRO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Nagarro')
  assert.equal(provider.companyCareerPage, 'https://www.nagarro.com/en/careers/job-search')
  assert.equal(provider.companyDomain, 'nagarro.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.match(provider.modulePath, /nagarro[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /nagarro[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
