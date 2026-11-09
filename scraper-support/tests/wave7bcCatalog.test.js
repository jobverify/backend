import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalog = async (relativePath, constantName) => {
  try {
    const module = await import(relativePath)
    return {
      constant: module[constantName],
      defaultExport: module.default,
    }
  } catch {
    assert.fail(`Expected catalog module at ${relativePath}`)
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

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('AVASO Technology Solutions local catalog captures the verified first-party SuccessFactors search board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/avasotechnologysolutions/catalog.js',
    'AVASO_TECHNOLOGY_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'avasotechnologysolutions')
  assert.equal(provider.companyName, 'AVASO Technology Solutions')
  assert.equal(provider.officialBrandName, 'AVASO TECH PRIVATE LIMITED')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.avasotech.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.avasotech.com/search/?createNewAlert=false&q=&locationsearch=')
  assert.equal(provider.officialCareersLandingUrl, 'https://careers.avasotech.com/job/')
  assert.equal(provider.companyDomain, 'careers.avasotech.com')
  assert.equal(provider.atsPlatform, 'first-party-successfactors-search-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'successfactors-search-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-successfactors-search-results+detail-pages+india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Results 1 – 25 of 32/i)
  assert.match(provider.verifiedSurfaceSummary, /Service Desk Coordinator/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Manager Service Delivery/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'AVASO Technology Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/avasotechnologysolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('RM Education Solutions local catalog captures the verified RM India shell plus fail-closed Jibe contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/rmeducationsolutions/catalog.js',
    'RM_EDUCATION_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'rmeducationsolutions')
  assert.equal(provider.companyName, 'RM Education Solutions')
  assert.equal(provider.officialBrandName, 'RM India (RM Education Solutions India Private Limited)')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rmindia.co.in/')
  assert.equal(provider.companyCareerPage, 'https://careers.rm.com/jobs')
  assert.equal(provider.locationsIndexUrl, 'https://careers.rm.com/jobs/locations')
  assert.equal(provider.indiaCountryJobsUrl, 'https://careers.rm.com/jobs/locations/country/India')
  assert.equal(provider.companyDomain, 'careers.rm.com')
  assert.equal(provider.atsPlatform, 'rm-jibe-careers-shell-with-untrusted-public-listing-feed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'rm-india-page-plus-empty-jibe-country-shell')
  assert.equal(
    provider.extractionStrategy,
    'verified-rm-india-page+verified-jibe-jobs-shell+verified-empty-country-route+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Life @ RM India/i)
  assert.match(provider.verifiedSurfaceSummary, /See jobs by: Categories Locations/i)
  assert.match(provider.verifiedSurfaceSummary, /title-only shells/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'RM Education Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/rmeducationsolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Yamaha Motors Solutions local catalog captures the verified careers page plus public zwayam search API', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/yamahamotorssolutions/catalog.js',
    'YAMAHA_MOTORS_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'yamahamotorssolutions')
  assert.equal(provider.companyName, 'Yamaha Motors Solutions')
  assert.equal(provider.officialBrandName, 'Yamaha Motor Solutions (India) Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.ymsl.in/ymsl/')
  assert.equal(provider.companyDomain, 'careers.ymsl.in')
  assert.equal(provider.searchApiUrl, 'https://public.zwayam.com/manageESQueries/searchJob')
  assert.equal(provider.companyApiId, '15506')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-zwayam-search-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'zwayam-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-zwayam-search-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Find Authentic Jobs at Yamaha Motor Solutions/i)
  assert.match(provider.verifiedSurfaceSummary, /manageESQueries\/searchJob/i)
  assert.match(provider.verifiedSurfaceSummary, /React Solution Architect/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Yamaha Motors Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/yamahamotorssolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('smartData Enterprises local catalog captures the verified first-party inline openings page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/smartdataenterprises/catalog.js',
    'SMARTDATA_ENTERPRISES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'smartdataenterprises')
  assert.equal(provider.companyName, 'smartData Enterprises')
  assert.equal(provider.officialBrandName, 'smartData')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.smartdatainc.com/careers/')
  assert.equal(provider.companyDomain, 'smartdatainc.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-inline-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-awsm-job-listings+inline-descriptions+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Associate Software Developer – \.NET \(MS\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Java Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Group/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'smartData Enterprises',
    modulePath: path.resolve(currentDir, '../../scraper/smartdataenterprises/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Civica India local catalog captures the verified current corporate handoff and full native Workable inventory', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/civicaindia/catalog.js',
    'CIVICA_INDIA_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'civicaindia')
  assert.equal(provider.companyName, 'Civica India')
  assert.equal(provider.officialBrandName, 'Civica')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.civica.com/en-in/about-us/careers/')
  assert.equal(provider.workablePageUrl, 'https://apply.workable.com/civica-uk-ltd-1/')
  assert.equal(provider.nativeAccountUrl, 'https://apply.workable.com/api/v1/accounts/civica-uk-ltd-1')
  assert.equal(provider.companyDomain, 'civica.com')
  assert.equal(provider.atsPlatform, 'workable-native-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'unfiltered-native-cursor-total-and-closing-snapshot-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'current-regional-corporate-handoff+exact-native-account-and-website+full-published-india-details',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-26')
  assert.match(provider.verifiedSurfaceSummary, /Our vacancies/i)
  assert.match(provider.verifiedSurfaceSummary, /closing snapshot/i)
  assert.match(provider.verifiedSurfaceSummary, /civica-uk-ltd-1/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Civica India',
    modulePath: path.resolve(currentDir, '../../scraper/civicaindia/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
