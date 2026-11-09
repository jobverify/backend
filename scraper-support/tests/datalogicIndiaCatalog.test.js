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
const modulePath = path.resolve(currentDir, '../../scraper/datalogicindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/datalogicindia/catalog.js')
  } catch {
    assert.fail('Expected Datalogic India catalog module at ../../scraper/datalogicindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/datalogicindia/script.js')
  } catch {
    assert.fail('Expected Datalogic India scraper module at ../../scraper/datalogicindia/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Datalogic India local catalog captures the verified first-party careers handoff and public SuccessFactors India sample role', async () => {
  const { DATALOGIC_INDIA_CATALOG } = await loadCatalogModule()
  const datalogicIndia = await loadScraperModule()
  const provider = buildCatalogReadyProvider(DATALOGIC_INDIA_CATALOG)

  assert.equal(provider.source, 'datalogicindia')
  assert.equal(provider.companyName, 'Datalogic India')
  assert.equal(provider.officialBrandName, 'Datalogic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.datalogic.com/')
  assert.equal(provider.companyCareerPage, 'https://www.datalogic.com/eng/company/careers-ca-26.html')
  assert.equal(provider.successFactorsCompanyToken, 'datalogics')
  assert.equal(provider.successFactorsBoardUrl, 'https://career2.successfactors.eu/career?company=datalogics')
  assert.equal(
    provider.successFactorsSearchUrl,
    'https://career2.successfactors.eu/career?company=datalogics&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://career2.successfactors.eu/career?career_ns=job_listing&company=datalogics&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=11363&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  )
  assert.equal(provider.companyDomain, 'datalogic.com')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'successfactors-dwr-initial-search')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+successfactors-bootstrap+dwr-search-results+india-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.dryRunFile, /datalogicindia[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.datalogic\.com\/eng\/company\/careers-ca-26\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/career2\.successfactors\.eu\/career\?company=datalogics/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /\b63 global postings\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b1 India role\b/i)
  assert.match(provider.verifiedSurfaceSummary, /India Finance Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /\b11363\b/)

  assert.equal(datalogicIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(datalogicIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    datalogicIndia.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(
    datalogicIndia.PROVIDER_METADATA.successFactorsSearchUrl,
    provider.successFactorsSearchUrl,
  )
})

test('Datalogic India exact backlog name matches from the local provider contract without aliases', async () => {
  const { DATALOGIC_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Datalogic India\n',
    catalog: [buildCatalogReadyProvider(DATALOGIC_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Datalogic India', 'datalogicindia', 'Datalogic India']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Datalogic India'), false)
})

test('buildScrapers and company coverage resolve Datalogic India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datalogicindia')
  const scraper = buildScrapers().find((item) => item.name === 'datalogicindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Datalogic India')
  assert.equal(provider.officialBrandName, 'Datalogic')
  assert.equal(provider.companyCareerPage, 'https://www.datalogic.com/eng/company/careers-ca-26.html')
  assert.match(scraper.dryRunFile, /datalogicindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Datalogic India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Datalogic India', 'datalogicindia', 'Datalogic India']],
  )
})
