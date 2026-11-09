import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/diageoindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/diageoindia/catalog.js')
  } catch {
    assert.fail('Expected Diageo India catalog module at ../../scraper/diageoindia/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Diageo India local catalog captures the verified India careers hub plus global public jobs surface without alias churn', async () => {
  const {
    DIAGEO_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(DIAGEO_INDIA_CATALOG)

  assert.equal(defaultCatalog, DIAGEO_INDIA_CATALOG)
  assert.equal(provider.source, 'diageoindia')
  assert.equal(provider.companyName, 'Diageo India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.diageo.com/en/careers/search-and-apply')
  assert.equal(provider.homepageUrl, 'https://www.diageoindia.com/')
  assert.equal(provider.indiaCareersUrl, 'https://www.diageoindia.com/careers')
  assert.equal(provider.indiaOpportunitiesUrl, 'https://www.diageoindia.com/en/careers/opportunities-at-diageo')
  assert.equal(provider.jobsApiUrl, 'https://diageo-prod-api.connectid.cloud/api/jobs')
  assert.equal(provider.sampleDetailUrl, 'https://www.diageo.com/en/careers/search-and-apply/senior-executive-unit-supply-chain/JR1127198')
  assert.equal(provider.sampleExternalPostingUrl, 'https://diageo.wd3.myworkdayjobs.com/Diageo_Careers/job/Aurangabad-India/Senior-Executive---Unit-Supply-Chain_JR1127198')
  assert.equal(provider.companyDomain, 'diageoindia.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-public-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-careers-pages-plus-country-filtered-public-api-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-homepage+verified-india-careers-pages+verified-global-search-and-apply-page+public-api-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /diageoindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.diageoindia\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.diageoindia\.com\/en\/careers\/opportunities-at-diageo/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.diageo\.com\/en\/careers\/search-and-apply/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/diageo-prod-api\.connectid\.cloud\/api\/jobs\?page=1&country=India/i)
  assert.match(provider.verifiedSurfaceSummary, /5 India openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Diageo India'), false)
})

test('Diageo India backlog row matches directly from the local provider metadata without an alias entry', async () => {
  const { DIAGEO_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Diageo India\n',
    catalog: [buildCatalogReadyProvider(DIAGEO_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Diageo India', 'diageoindia', 'Diageo India']],
  )
})

test('buildScrapers and company coverage resolve Diageo India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'diageoindia')
  const scraper = buildScrapers().find((item) => item.name === 'diageoindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Diageo India')
  assert.equal(provider.companyCareerPage, 'https://www.diageo.com/en/careers/search-and-apply')
  assert.match(scraper.dryRunFile, /diageoindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Diageo India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Diageo India', 'diageoindia', 'Diageo India']],
  )
})
