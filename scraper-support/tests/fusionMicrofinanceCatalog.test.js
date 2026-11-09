import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fusionmicrofinance/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fusionmicrofinance/catalog.js')
  } catch {
    assert.fail('Expected Fusion Microfinance catalog module at ../../scraper/fusionmicrofinance/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/fusionmicrofinance/script.js')
  } catch {
    assert.fail('Expected Fusion Microfinance scraper module at ../../scraper/fusionmicrofinance/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Fusion Microfinance local catalog captures the verified first-party careers form and detail-page contract', async () => {
  const { FUSION_MICROFINANCE_CATALOG } = await loadCatalogModule()
  const fusionMicrofinance = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FUSION_MICROFINANCE_CATALOG)

  assert.equal(provider.source, 'fusionmicrofinance')
  assert.equal(provider.companyName, 'Fusion Microfinance')
  assert.equal(provider.officialBrandName, 'Fusion Finance')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://fusionfin.com/')
  assert.equal(provider.companyCareerPage, 'https://fusionfin.com/careers/')
  assert.equal(provider.genericApplicationUrl, 'https://fusionfin.com/careers/')
  assert.equal(provider.recruiterEmail, 'recruiter@fusionfin.com')
  assert.deepEqual(provider.verifiedGenericJobTitles, [
    'MFI - Relationship Officer',
    'MFI - Audit Officer',
    'MFI - Branch Manager',
    'MFI - Area Manager',
    'MSME - Business Development Officer',
    'MSME - Credit Officer',
    'MSME - Executive Operations',
  ])
  assert.deepEqual(provider.verifiedFeaturedRoleUrls, [
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  ])
  assert.equal(
    provider.verifiedFeaturedRoleDetailExampleUrl,
    'https://fusionfin.com/featuredjobs/qa-engineer-sr-qa-engineer/',
  )
  assert.equal(provider.companyDomain, 'fusionfin.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-same-domain-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+inline-generic-job-form+same-domain-detail-pages+inline-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /fusionmicrofinance[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fusionfin\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/fusionfin\.com\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/fusionfin\.com\/featuredjobs\/qa-engineer-sr-qa-engineer\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Formerly known as “?Fusion Micro Finance Limited/i)
  assert.match(provider.verifiedSurfaceSummary, /MFI - Relationship Officer/i)
  assert.match(provider.verifiedSurfaceSummary, /MSME - Executive Operations/i)
  assert.match(provider.verifiedSurfaceSummary, /recruiter@fusionfin\.com/i)

  assert.equal(fusionMicrofinance.PROVIDER_METADATA.source, provider.source)
  assert.equal(fusionMicrofinance.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fusionMicrofinance.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.deepEqual(
    fusionMicrofinance.GENERIC_JOB_TITLES,
    provider.verifiedGenericJobTitles,
  )
  assert.deepEqual(
    fusionMicrofinance.FEATURED_ROLE_URLS,
    provider.verifiedFeaturedRoleUrls,
  )
})

test('Fusion Microfinance exact backlog row matches directly from the local provider contract without aliases', async () => {
  const { FUSION_MICROFINANCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fusion Microfinance\n',
    catalog: [buildCatalogReadyProvider(FUSION_MICROFINANCE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fusion Microfinance', 'fusionmicrofinance', 'Fusion Microfinance']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fusion Microfinance'), false)
})
