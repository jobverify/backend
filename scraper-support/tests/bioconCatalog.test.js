import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/biocon/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/biocon/catalog.js')
  } catch {
    assert.fail('Expected Biocon catalog module at ../../scraper/biocon/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/biocon/script.js')
  } catch {
    assert.fail('Expected Biocon scraper module at ../../scraper/biocon/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Biocon local catalog captures the verified first-party careers handoff to the public SuccessFactors board', async () => {
  const { BIOCON_CATALOG } = await loadCatalogModule()
  const biocon = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BIOCON_CATALOG)

  assert.equal(provider.source, 'biocon')
  assert.equal(provider.companyName, 'Biocon')
  assert.equal(provider.officialBrandName, 'Biocon Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.biocon.com/')
  assert.equal(provider.companyCareerPage, 'https://www.biocon.com/careers/')
  assert.equal(provider.successFactorsCompanyToken, 'bioconlimi')
  assert.equal(provider.successFactorsBoardUrl, 'https://career10.successfactors.com/career?company=bioconlimi')
  assert.equal(
    provider.successFactorsSearchUrl,
    'https://career10.successfactors.com/career?company=bioconlimi&career_ns=job_listing_summary&navBarLevel=JOB_SEARCH&',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://career10.successfactors.com/career?career_ns=job_listing&company=bioconlimi&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&career_job_req_id=20915&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=Asia/Calcutta',
  )
  assert.equal(provider.companyDomain, 'biocon.com')
  assert.equal(provider.atsPlatform, 'successfactors')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'successfactors-dwr-initial-search')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-biocon-careers-page+successfactors-bootstrap+dwr-search-results+detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.dryRunFile, /biocon[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.biocon\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/career10\.successfactors\.com\/career\?company=bioconlimi/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /39 India postings/i)
  assert.match(provider.verifiedSurfaceSummary, /20915/i)

  assert.equal(biocon.PROVIDER_METADATA.source, provider.source)
  assert.equal(biocon.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(biocon.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    biocon.PROVIDER_METADATA.successFactorsBoardUrl,
    provider.successFactorsBoardUrl,
  )
})

test('Biocon exact backlog name matches from the local provider contract without aliases', async () => {
  const { BIOCON_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Biocon\n',
    catalog: [buildCatalogReadyProvider(BIOCON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Biocon', 'biocon', 'Biocon']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Biocon'), false)
})
