import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bharatdynamics/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bharatdynamics/catalog.js')
  } catch {
    assert.fail('Expected Bharat Dynamics catalog module at ../../scraper/bharatdynamics/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/bharatdynamics/script.js')
  } catch {
    assert.fail('Expected Bharat Dynamics scraper module at ../../scraper/bharatdynamics/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bharat Dynamics local catalog captures the verified first-party recruitment-table surface', async () => {
  const { BHARAT_DYNAMICS_CATALOG } = await loadCatalogModule()
  const bharatDynamics = await loadScraperModule()
  const provider = buildCatalogReadyProvider(BHARAT_DYNAMICS_CATALOG)

  assert.equal(provider.source, 'bharatdynamics')
  assert.equal(provider.companyName, 'Bharat Dynamics')
  assert.equal(provider.officialBrandName, 'Bharat Dynamics Limited (BDL)')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://bdl-india.in/')
  assert.equal(provider.companyCareerPage, 'https://bdl-india.in/recruitments')
  assert.equal(provider.pageTwoUrl, 'https://bdl-india.in/recruitments?page=1')
  assert.equal(provider.externalVacancyPortalUrl, 'https://www.ncs.gov.in/')
  assert.equal(provider.companyDomain, 'bdl-india.in')
  assert.equal(provider.atsPlatform, 'official-recruitment-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-recruitments-root-plus-page-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-recruitment-handoff+paginated-official-recruitment-table+conservative-actionable-notice-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.dryRunFile, /bharatdynamics[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bdl-india\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bdl-india\.in\/recruitments/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bdl-india\.in\/recruitments\?page=1/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ncs\.gov\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /one currently actionable first-party notice/i)

  assert.equal(bharatDynamics.PROVIDER_METADATA.source, provider.source)
  assert.equal(bharatDynamics.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(
    bharatDynamics.PROVIDER_METADATA.companyCareerPage,
    provider.companyCareerPage,
  )
  assert.equal(
    bharatDynamics.PROVIDER_METADATA.externalVacancyPortalUrl,
    provider.externalVacancyPortalUrl,
  )
})

test('Bharat Dynamics exact backlog name matches from the local provider contract without aliases', async () => {
  const { BHARAT_DYNAMICS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Dynamics\n',
    catalog: [buildCatalogReadyProvider(BHARAT_DYNAMICS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat Dynamics', 'bharatdynamics', 'Bharat Dynamics']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bharat Dynamics'), false)
})
