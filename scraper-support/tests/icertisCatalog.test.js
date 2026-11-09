import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/icertis/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/icertis/catalog.js')
  } catch {
    assert.fail('Expected Icertis catalog module at ../../scraper/icertis/catalog.js')
  }
}

const loadIcertisModule = async () => {
  try {
    return await import('../../scraper/icertis/script.js')
  } catch {
    assert.fail('Expected Icertis scraper module at ../../scraper/icertis/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Icertis local catalog captures the verified first-party careers handoff and Oracle India jobs surface', async () => {
  const { ICERTIS_CATALOG } = await loadCatalogModule()
  const icertis = await loadIcertisModule()
  const provider = buildCatalogReadyProvider(ICERTIS_CATALOG)

  assert.equal(provider.source, 'icertis')
  assert.equal(provider.companyName, 'Icertis')
  assert.equal(provider.officialBrandName, 'Icertis')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.icertis.com/company/careers/')
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/?',
  )
  assert.equal(provider.workspaceDomain, 'iaaviz.fa.ocs.oraclecloud.com')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.publicJobsBaseUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/',
  )
  assert.equal(provider.siteNumber, 'Jobs-at-Icertis')
  assert.equal(provider.candidateExperienceShellSiteNumber, 'CX_1')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query-location-filter')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+oracle-cloud-candidate-experience+oracle-cloud-india-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'icertis.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedIndiaRoleCount, 9)
  assert.equal(provider.verifiedSampleJobId, '7407')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://iaaviz.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/Jobs-at-Icertis/job/7407',
  )
  assert.match(provider.dryRunFile, /icertis[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.icertis\.com\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Explore Open Roles/i)
  assert.match(provider.verifiedSurfaceSummary, /9 India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Functional Consultant, Customer Support\(L2\)/i)
  assert.equal(provider.modulePath, modulePath)

  assert.equal(icertis.PROVIDER_METADATA.source, ICERTIS_CATALOG.source)
  assert.equal(icertis.PROVIDER_METADATA.companyName, ICERTIS_CATALOG.companyName)
  assert.equal(icertis.PROVIDER_METADATA.listingApiBaseUrl, ICERTIS_CATALOG.listingApiBaseUrl)
})

test('one icertis provider plus a single alias can cover both Icertis and Icertis India backlog rows', async () => {
  const { ICERTIS_CATALOG } = await loadCatalogModule()
  assert.equal(companyAliases['Icertis India'], 'icertis')
  const report = generateCompanyCoverageReport({
    csvText: 'Icertis\nIcertis India\n',
    catalog: [buildCatalogReadyProvider(ICERTIS_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.totalRows, 2)
  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Icertis', 'icertis', 'Icertis'],
      ['Icertis India', 'icertis', 'Icertis'],
    ],
  )
})

test('getScraperCatalog includes Icertis as a verified Oracle Cloud provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'icertis')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Icertis')
  assert.equal(provider.companyCareerPage, 'https://www.icertis.com/company/careers/')
  assert.equal(provider.companyDomain, 'icertis.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.modulePath, /icertis[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Icertis scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'icertis')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'icertis')
  assert.equal(scraper.provider.atsPlatform, 'oracle-cloud')
  assert.match(scraper.dryRunFile, /icertis[\\/]jobs\.json$/i)
})
