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

const assertCatalogMatchesBacklogRow = ({ provider, companyName, modulePath }) => {
  assert.equal(provider.companyName, companyName)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.modulePath, modulePath)

  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
}

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('Novigo Solutions local catalog captures the verified first-party careers page with visible inline roles', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/novigosolutions/catalog.js',
    'NOVIGO_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'novigosolutions')
  assert.equal(provider.officialBrandName, 'Novigo Solutions')
  assert.equal(provider.homepageUrl, 'https://www.novigosolutions.com/')
  assert.equal(provider.companyCareerPage, 'https://www.novigosolutions.com/careers-life-at-novigo')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-inline-role-list')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-inline-role-sections+same-page-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /\.Net Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Angular Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /RPA Ui Path Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /MS SQL Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore \/ Mangalore \/ Remote work during Pandemic/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Novigo Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/novigosolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Applied Cloud Computing local catalog captures the current SmartRecruiters board shell and API contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/appliedcloudcomputing/catalog.js',
    'APPLIED_CLOUD_COMPUTING_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'appliedcloudcomputing')
  assert.equal(provider.officialBrandName, 'Applied Cloud Computing')
  assert.equal(provider.homepageUrl, 'https://www.appliedcloudcomputing.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.smartrecruiters.com/AppliedCloudComputing')
  assert.equal(provider.boardUrl, 'https://careers.smartrecruiters.com/AppliedCloudComputing')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.paginationStrategy, 'exact-name-smartrecruiters-board-plus-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-smartrecruiters-board+official-homepage-link+smartrecruiters-jobs-api+detail-api',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /4 India postings/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud Network Security Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /L2 CDN & Edge Security Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /appliedcloudcomputing\.com/i)
  assert.match(provider.config.discovery.listingApiUrl, /api\.smartrecruiters\.com\/v1\/companies\/AppliedCloudComputing\/postings/i)
  assert.match(provider.config.detail.urlTemplate, /api\.smartrecruiters\.com\/v1\/companies\/AppliedCloudComputing\/postings\/\{\{jobId\}\}/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Applied Cloud Computing',
    modulePath: path.resolve(currentDir, '../../scraper/appliedcloudcomputing/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Mobiloitte Technologies local catalog captures the current first-party role cards', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mobiloittetechnologies/catalog.js',
    'MOBILOITTE_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mobiloittetechnologies')
  assert.equal(provider.officialBrandName, 'Mobiloitte')
  assert.equal(provider.homepageUrl, 'https://www.mobiloitte.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mobiloitte.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-visible-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-role-cards+canonical-role-details+empty-state-fallback',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /four Delhi job cards/i)
  assert.match(provider.verifiedSurfaceSummary, /listing-incomplete/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Mobiloitte Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/mobiloittetechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Competent Software local catalog captures the verified first-party careers no-open-positions note', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/competentsoftware/catalog.js',
    'COMPETENT_SOFTWARE_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'competentsoftware')
  assert.equal(provider.officialBrandName, 'Competent Software')
  assert.equal(provider.homepageUrl, 'https://competentsoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://competentsoftware.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-no-open-positions-note')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+explicit-no-open-positions-note+resume-form-fail-closed',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Process Associate/i)
  assert.match(provider.verifiedSurfaceSummary, /Currently there are no open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@competentsoftware\.com/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Competent Software',
    modulePath: path.resolve(currentDir, '../../scraper/competentsoftware/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Vserve Ebusiness Solutions local catalog captures the verified careers page and embedded Zoho job portal contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/vserveebusinesssolutions/catalog.js',
    'VSERVE_EBUSINESS_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'vserveebusinesssolutions')
  assert.equal(provider.officialBrandName, 'Vserve eBusiness Solutions')
  assert.equal(provider.homepageUrl, 'https://vservesolution.com/')
  assert.equal(provider.companyCareerPage, 'https://vservesolution.com/careers/')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-embedded-zoho-recruit-portal')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-embedded-zoho-job-table')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-zoho-job-table+detail-pages+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.match(provider.verifiedSurfaceSummary, /recruit\.zoho\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Full Stack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Pasig/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Vserve Ebusiness Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/vserveebusinesssolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
