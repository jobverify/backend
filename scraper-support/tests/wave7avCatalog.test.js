import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadModule = async (relativePath, label) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected ${label} at ${relativePath}`)
  }
}

const assertBacklogRowMatches = ({ provider, companyName, modulePath }) => {
  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(provider.modulePath, modulePath)
}

test('Marquis Technologies local provider captures the verified trustworthy homepage plus compromised careers route contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/marquistechnologies/script.js')
  const providerModule = await loadModule('../../scraper/marquistechnologies/provider.js', 'provider module')
  const scriptModule = await loadModule('../../scraper/marquistechnologies/script.js', 'scraper module')
  const provider = providerModule.provider

  assert.equal(providerModule.default, provider)
  assert.equal(provider.source, 'marquistechnologies')
  assert.equal(provider.companyName, 'Marquis Technologies')
  assert.equal(provider.officialBrandName, 'Marquistech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.marquistech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.marquistech.com/job-openings/')
  assert.equal(provider.companyDomain, 'marquistech.com')
  assert.equal(provider.atsPlatform, 'official-homepage-plus-compromised-careers-route')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-compromised-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-compromised-job-openings-route+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /NABUNG77/i)
  assert.match(provider.verifiedSurfaceSummary, /job-openings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, provider)

  assertBacklogRowMatches({
    provider,
    companyName: 'Marquis Technologies',
    modulePath,
  })
})

test('V2soft local catalog captures the verified India careers listing and first-party detail pages', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/v2soft/script.js')
  const catalogModule = await loadModule('../../scraper/v2soft/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/v2soft/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.V2SOFT_CATALOG)

  assert.equal(catalogModule.default, catalogModule.V2SOFT_CATALOG)
  assert.equal(provider.source, 'v2soft')
  assert.equal(provider.companyName, 'V2soft')
  assert.equal(provider.officialBrandName, 'V2Soft')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.v2soft.com/')
  assert.equal(provider.companyCareerPage, 'https://marketing.v2soft.com/india-careers/')
  assert.equal(provider.companyDomain, 'v2soft.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-inline-listing-and-detail-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+first-party-view-job-links+first-party-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Hadoop \+ Java/i)
  assert.match(provider.verifiedSurfaceSummary, /Digital Marketing Lead/i)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'V2soft',
    modulePath,
  })
})

test('Colan Infotech local catalog captures the verified first-party job-card detail-panel contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/colaninfotech/script.js')
  const catalogModule = await loadModule('../../scraper/colaninfotech/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/colaninfotech/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.COLAN_INFOTECH_CATALOG)

  assert.equal(catalogModule.default, catalogModule.COLAN_INFOTECH_CATALOG)
  assert.equal(provider.source, 'colaninfotech')
  assert.equal(provider.companyName, 'Colan Infotech')
  assert.equal(provider.officialBrandName, 'Colan Infotech Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://colaninfotech.com/')
  assert.equal(provider.companyCareerPage, 'https://colaninfotech.com/career/')
  assert.equal(provider.companyDomain, 'colaninfotech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-single-page-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-inline-job-table-rows+verified-inline-detail-panels+same-page-apply-modal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /Android Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /job-card rows/i)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Colan Infotech',
    modulePath,
  })
})

test('Customer Analytics local catalog captures the verified inline current opportunities contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/customeranalytics/script.js')
  const catalogModule = await loadModule('../../scraper/customeranalytics/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/customeranalytics/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.CUSTOMER_ANALYTICS_CATALOG)

  assert.equal(catalogModule.default, catalogModule.CUSTOMER_ANALYTICS_CATALOG)
  assert.equal(provider.source, 'customeranalytics')
  assert.equal(provider.companyName, 'Customer Analytics')
  assert.equal(provider.officialBrandName, 'Customer Analytics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.customeranalytics.com/')
  assert.equal(provider.companyCareerPage, 'https://www.customeranalytics.com/company/careers')
  assert.equal(provider.companyDomain, 'customeranalytics.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-inline-opportunities')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-opportunity-cards+inline-detail-panels+onsite-office-location-cue',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.verifiedSurfaceSummary, /MS Dynamics 365 F&O Functional Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /MS Dynamics 365 F&O Developer/i)
  assert.equal(provider.modulePath, modulePath)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Customer Analytics',
    modulePath,
  })
})

test('Mawai Infotech local provider captures the verified form-only careers page fail-closed contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/mawaiinfotech/script.js')
  const providerModule = await loadModule('../../scraper/mawaiinfotech/provider.js', 'provider module')
  const scriptModule = await loadModule('../../scraper/mawaiinfotech/script.js', 'scraper module')
  const provider = providerModule.provider

  assert.equal(providerModule.default, provider)
  assert.equal(provider.source, 'mawaiinfotech')
  assert.equal(provider.companyName, 'Mawai Infotech')
  assert.equal(provider.officialBrandName, 'Mawai Infotech Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mawai.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mawai.com/carrer-sap')
  assert.equal(provider.companyDomain, 'mawai.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-form-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-form+generic-role-categories-without-openings+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /SAP Consultants/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Experts/i)
  assert.equal(provider.modulePath, modulePath)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, provider)

  assertBacklogRowMatches({
    provider,
    companyName: 'Mawai Infotech',
    modulePath,
  })
})
