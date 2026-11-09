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

test('Tangoe local catalog captures the verified first-party careers page and opaque ADP handoff sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/tangoe/catalog.js', 'TANGOE_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'tangoe')
  assert.equal(provider.companyName, 'Tangoe')
  assert.equal(provider.officialBrandName, 'Tangoe')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tangoe.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tangoe.com/careers/')
  assert.equal(provider.careersVendorHost, 'workforcenow.adp.com')
  assert.equal(provider.companyDomain, 'tangoe.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-opaque-adp-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-page-only')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+opaque-adp-search-handoff+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Search Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /workforcenow\.adp\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs inventory/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Tangoe',
    modulePath: path.resolve(currentDir, '../../scraper/tangoe/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Smart Energy Water local catalog captures the verified SEW careers shell and India-detail-only sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/smartenergywater/catalog.js',
    'SMART_ENERGY_WATER_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'smartenergywater')
  assert.equal(provider.companyName, 'Smart Energy Water')
  assert.equal(provider.officialBrandName, 'SEW.AI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sew.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.sew.ai/sew-career')
  assert.equal(provider.knownIndiaJobDetailUrl, 'https://www.sew.ai/careers/product-engineer-net')
  assert.equal(provider.companyDomain, 'sew.ai')
  assert.equal(provider.atsPlatform, 'first-party-careers-site-with-unenumerable-detail-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'detail-pages-not-indexed-publicly')
  assert.equal(
    provider.extractionStrategy,
    'verified-sew-careers-branding+verified-india-job-detail-page+no-trustworthy-public-listing-index+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /SEW\.AI careers landing page/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Engineer- \.Net/i)
  assert.match(provider.verifiedSurfaceSummary, /Noida \(India\)/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Smart Energy Water',
    modulePath: path.resolve(currentDir, '../../scraper/smartenergywater/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Lumiq local catalog captures the verified first-party careers page and public Zoho Recruit board', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/lumiq/catalog.js', 'LUMIQ_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'lumiq')
  assert.equal(provider.companyName, 'Lumiq')
  assert.equal(provider.officialBrandName, 'LUMIQ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.lumiq.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.lumiq.ai/careers/')
  assert.equal(provider.officialZohoBoardUrl, 'https://lumiq.zohorecruit.in/careers')
  assert.equal(
    provider.jobsApiUrl,
    'https://lumiq.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(provider.companyDomain, 'lumiq.ai')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-embedded-board-and-public-api-id-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-current-zoho-handoff+embedded-board-and-api-id-match+india-job-details',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /complete seven-job collection/i)
  assert.match(provider.verifiedSurfaceSummary, /lumiq\.zohorecruit\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead DevOps Engineer/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Lumiq',
    modulePath: path.resolve(currentDir, '../../scraper/lumiq/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Shipco It local catalog captures the verified first-party careers shell and client-rendered search sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/shipcoit/catalog.js',
    'SHIPCO_IT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'shipcoit')
  assert.equal(provider.companyName, 'Shipco It')
  assert.equal(provider.officialBrandName, 'Shipco Transport')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.shipco.com/')
  assert.equal(provider.companyCareerPage, 'https://www.shipco.com/career')
  assert.equal(provider.companyDomain, 'shipco.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-shell-with-client-rendered-search-form')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-shell-no-server-rendered-openings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+search-form-without-server-rendered-openings+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Apply for a job/i)
  assert.match(provider.verifiedSurfaceSummary, /Title Office Job Type Date Of Publishing/i)
  assert.match(provider.verifiedSurfaceSummary, /no server-rendered public inventory/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Shipco It',
    modulePath: path.resolve(currentDir, '../../scraper/shipcoit/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Flatworld Mortgage Processing local catalog captures the verified application-form-only sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/flatworldmortgageprocessing/catalog.js',
    'FLATWORLD_MORTGAGE_PROCESSING_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'flatworldmortgageprocessing')
  assert.equal(provider.companyName, 'Flatworld Mortgage Processing')
  assert.equal(provider.officialBrandName, 'Flatworld Mortgage Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.flatworldmortgage.com/')
  assert.equal(provider.companyCareerPage, 'https://www.flatworldsolutions.com/careers/forms/apply.php')
  assert.equal(provider.companyDomain, 'flatworldsolutions.com')
  assert.equal(provider.atsPlatform, 'first-party-generic-careers-form')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-generic-application-form')
  assert.equal(
    provider.extractionStrategy,
    'verified-generic-application-form+role-dropdown-without-public-openings+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Please fill in the form below/i)
  assert.match(provider.verifiedSurfaceSummary, /Mortgage Processor/i)
  assert.match(provider.verifiedSurfaceSummary, /Mortgage Underwriters/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Flatworld Mortgage Processing',
    modulePath: path.resolve(currentDir, '../../scraper/flatworldmortgageprocessing/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
