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
const modulePath = path.resolve(currentDir, '../../scraper/amnexinfotechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amnexinfotechnologies/catalog.js')
  } catch {
    assert.fail(
      'Expected Amnex InfoTechnologies catalog module at ../../scraper/amnexinfotechnologies/catalog.js',
    )
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/amnexinfotechnologies/script.js')
  } catch {
    assert.fail(
      'Expected Amnex InfoTechnologies scraper module at ../../scraper/amnexinfotechnologies/script.js',
    )
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Amnex InfoTechnologies local catalog captures the verified first-party careers surface', async () => {
  const { AMNEX_INFOTECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const amnexInfoTechnologies = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AMNEX_INFOTECHNOLOGIES_CATALOG)

  assert.equal(provider.source, 'amnexinfotechnologies')
  assert.equal(provider.companyName, 'Amnex InfoTechnologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://amnex.com/professional-opportunities/')
  assert.equal(provider.companyDomain, 'amnex.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-wordpress-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-jobs-rest-api-plus-taxonomy-lookup')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-career-handoff+verified-openings-page+wp-json-jobs+same-domain-detail-pages+inline-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://amnex.com/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://amnex.com/career/')
  assert.equal(provider.jobsApiUrl, 'https://amnex.com/wp-json/wp/v2/jobs?per_page=100')
  assert.equal(
    provider.jobLocationsApiUrl,
    'https://amnex.com/wp-json/wp/v2/job_locations?per_page=100',
  )
  assert.equal(provider.jobYearsApiUrl, 'https://amnex.com/wp-json/wp/v2/job_years?per_page=100')
  assert.equal(provider.verifiedJobDetailUrl, 'https://amnex.com/jobs/cyber-security-expert/')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amnex\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amnex\.com\/career\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/amnex\.com\/professional-opportunities\//i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/amnex\.com\/wp-json\/wp\/v2\/jobs\?per_page=100/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /cyber-security-expert/i)
  assert.match(provider.verifiedSurfaceSummary, /inline application form/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /amnexinfotechnologies[\\/]jobs\.json$/i)

  assert.equal(amnexInfoTechnologies.PROVIDER_METADATA.source, provider.source)
  assert.equal(amnexInfoTechnologies.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    amnexInfoTechnologies.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(
    amnexInfoTechnologies.PROVIDER_METADATA.officialCareersHandoffUrl,
    provider.officialCareersHandoffUrl,
  )
  assert.equal(amnexInfoTechnologies.PROVIDER_METADATA.jobsApiUrl, provider.jobsApiUrl)
})

test('Amnex InfoTechnologies exact backlog name matches from the local provider contract without aliases', async () => {
  const { AMNEX_INFOTECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Amnex InfoTechnologies\n',
    catalog: [buildCatalogReadyProvider(AMNEX_INFOTECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amnex InfoTechnologies', 'amnexinfotechnologies', 'Amnex InfoTechnologies']],
  )
})

test('buildScrapers and company coverage resolve Amnex InfoTechnologies from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amnexinfotechnologies')
  const scraper = buildScrapers().find((item) => item.name === 'amnexinfotechnologies')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amnex InfoTechnologies')
  assert.equal(provider.companyCareerPage, 'https://amnex.com/professional-opportunities/')
  assert.match(scraper.dryRunFile, /amnexinfotechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amnex InfoTechnologies\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amnex InfoTechnologies', 'amnexinfotechnologies', 'Amnex InfoTechnologies']],
  )
})
