import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tatateleservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tatateleservices/catalog.js')
  } catch {
    assert.fail('Expected Tata Teleservices catalog module at ../../scraper/tatateleservices/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tatateleservices/script.js')
  } catch {
    assert.fail('Expected Tata Teleservices scraper module at ../../scraper/tatateleservices/script.js')
  }
}

test('Tata Teleservices local catalog captures the verified TTBS careers handoff to Oracle Cloud', async () => {
  const { TATA_TELESERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tata = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TATA_TELESERVICES_CATALOG)

  assert.equal(defaultCatalog, TATA_TELESERVICES_CATALOG)
  assert.equal(provider.source, 'tatateleservices')
  assert.equal(provider.companyName, 'Tata Teleservices')
  assert.equal(provider.officialBrandName, 'Tata Teleservices Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tatatelebusiness.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tatatelebusiness.com/careers/')
  assert.equal(
    provider.officialJobsHandoffUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  )
  assert.equal(
    provider.oracleCandidateExperienceUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?mode=job-location',
  )
  assert.equal(provider.workspaceDomain, 'fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com')
  assert.equal(
    provider.listingApiBaseUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions',
  )
  assert.equal(
    provider.detailApiBaseUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails',
  )
  assert.equal(
    provider.publicJobsBaseUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/',
  )
  assert.equal(provider.siteNumber, 'CX_1001')
  assert.equal(provider.companyDomain, 'tatatelebusiness.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'offset-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+verified-oracle-candidate-shell+oracle-cloud-finder-api+oracle-cloud-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedIndiaJobCount, 11)
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://fa-evmm-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/job/2411',
  )
  assert.match(provider.dryRunFile, /tatateleservices[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tatatelebusiness\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /11 India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Product - Managed WiFi/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tata Teleservices'), false)

  assert.equal(tata.PROVIDER_METADATA.source, TATA_TELESERVICES_CATALOG.source)
  assert.equal(tata.PROVIDER_METADATA.companyName, TATA_TELESERVICES_CATALOG.companyName)
  assert.equal(
    tata.PROVIDER_METADATA.oracleCandidateExperienceUrl,
    TATA_TELESERVICES_CATALOG.oracleCandidateExperienceUrl,
  )
})

test('Tata Teleservices backlog row matches directly from the local catalog without alias churn', async () => {
  const { TATA_TELESERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tata Teleservices\n',
    catalog: [hydrateProviderCatalogEntry(TATA_TELESERVICES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tata Teleservices', 'tatateleservices', 'Tata Teleservices']],
  )
})

test('Tata Teleservices hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TATA_TELESERVICES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TATA_TELESERVICES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tata Teleservices')
  assert.equal(provider.companyCareerPage, 'https://www.tatatelebusiness.com/careers/')
  assert.equal(provider.companyDomain, 'tatatelebusiness.com')
  assert.equal(provider.atsPlatform, 'oracle-cloud')
  assert.match(provider.modulePath, /tatateleservices[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tatateleservices[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
