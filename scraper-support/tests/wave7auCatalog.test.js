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

test('Excelra Knowledge Solutions local catalog captures the verified WordPress careers payload and Darwinbox apply links', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/excelraknowledgesolutions/catalog.js',
    'EXCELRA_KNOWLEDGE_SOLUTIONS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'excelraknowledgesolutions')
  assert.equal(provider.officialBrandName, 'Excelra')
  assert.equal(provider.homepageUrl, 'https://www.excelra.com/')
  assert.equal(provider.companyCareerPage, 'https://www.excelra.com/careers/')
  assert.equal(provider.careersPortalBaseUrl, 'https://excelra.darwinbox.in/ms/candidatev2/main/careers/')
  assert.equal(provider.careersWordpressApiUrl, 'https://www.excelra.com/wp-json/wp/v2/pages?slug=careers')
  assert.equal(provider.careersJobsApiUrl, 'https://www.excelra.com/wp-json/wp/v2/job_listing')
  assert.equal(provider.atsPlatform, 'first-party-wordpress-rendered-darwinbox-job-links')
  assert.equal(provider.paginationStrategy, 'wordpress-careers-record-plus-rendered-shortcode-or-paginated-job-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-wordpress-careers-page+rendered-darwinbox-cards-or-public-job-listings+complete-pagination+official-applications+explicit-country-filter',
  )
  assert.equal(provider.verifiedOn, '2026-10-19')
  assert.match(provider.verifiedSurfaceSummary, /October 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /darwinbox_jobs shortcode/i)
  assert.match(provider.verifiedSurfaceSummary, /wp-json\/wp\/v2\/job_listing/i)
  assert.match(provider.verifiedSurfaceSummary, /fourteen current Darwinbox IDs/i)
  assert.match(provider.verifiedSurfaceSummary, /official application IDs/i)
  assert.match(provider.verifiedSurfaceSummary, /eight India/i)
  assert.match(provider.verifiedSurfaceSummary, /historical static cards disabled/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Excelra Knowledge Solutions',
    modulePath: path.resolve(currentDir, '../../scraper/excelraknowledgesolutions/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Blazeclan Technologies local catalog captures the verified broken Zoho handoff and fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/blazeclantechnologies/catalog.js',
    'BLAZECLAN_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'blazeclantechnologies')
  assert.equal(provider.officialBrandName, 'Blazeclan')
  assert.equal(provider.homepageUrl, 'https://blazeclan.com/')
  assert.equal(provider.companyCareerPage, 'https://blazeclan.com/work-with-us/')
  assert.equal(provider.brokenBoardUrl, 'https://blazeclan.zohorecruit.in/jobs/Careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-broken-zoho-handoff')
  assert.equal(provider.paginationStrategy, 'single-first-party-work-with-us-page-plus-broken-board-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-work-with-us-page+dead-zoho-board-handoff+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /does not exist/i)
  assert.match(provider.verifiedSurfaceSummary, /zohorecruit/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Blazeclan Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/blazeclantechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Reserve Bank Information Technology local catalog captures the verified careers SPA and authenticated current-openings API contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/reservebankinformationtechnology/catalog.js',
    'RESERVE_BANK_INFORMATION_TECHNOLOGY_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'reservebankinformationtechnology')
  assert.equal(provider.officialBrandName, 'ReBIT')
  assert.equal(provider.homepageUrl, 'https://rebit.org.in/')
  assert.equal(provider.companyCareerPage, 'https://rebit.org.in/careers/')
  assert.equal(provider.careersPortalBaseUrl, 'https://rebithr.darwinbox.in/ms/candidatev2/main/careers/')
  assert.equal(provider.atsPlatform, 'first-party-careers-spa-authenticated-api')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-openings-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-spa+authenticated-current-openings-api+darwinbox-apply-links+experience-field',
  )
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /web\/api\/auth\/login/i)
  assert.match(provider.verifiedSurfaceSummary, /web\/api\/current-openings/i)
  assert.match(provider.verifiedSurfaceSummary, /rebithr\.darwinbox\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /14 active India openings/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Reserve Bank Information Technology',
    modulePath: path.resolve(currentDir, '../../scraper/reservebankinformationtechnology/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Amtex Systems local catalog captures the verified careers shell and non-India detail-page filter contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/amtexsystems/catalog.js',
    'AMTEX_SYSTEMS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'amtexsystems')
  assert.equal(provider.officialBrandName, 'Amtex Systems')
  assert.equal(provider.homepageUrl, 'https://www.amtexsystems.com/')
  assert.equal(provider.companyCareerPage, 'https://www.amtexsystems.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-detail-pages')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-real-and-placeholder-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+real-detail-links+placeholder-cards+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /career-list\/business-analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /href=\"#\" placeholders/i)
  assert.match(provider.verifiedSurfaceSummary, /New York, NY/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Amtex Systems',
    modulePath: path.resolve(currentDir, '../../scraper/amtexsystems/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Nucsoft local catalog captures the verified current openings cards and first-party opening routes', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/nucsoft/catalog.js',
    'NUCSOFT_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'nucsoft')
  assert.equal(provider.officialBrandName, 'NUCSOFT')
  assert.equal(provider.homepageUrl, 'https://nucsoft.com/')
  assert.equal(provider.companyCareerPage, 'https://nucsoft.com/career-base')
  assert.equal(provider.openingsPageUrl, 'https://nucsoft.com/openings')
  assert.equal(provider.applicationFormUrl, 'https://nucsoft.com/application-form')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-opening-links')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-carousel')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-opening-cards+opening-query-links',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Flutter Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /DBA\/SQL Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /nucsoft\.com\/openings\?job=/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Nucsoft',
    modulePath: path.resolve(currentDir, '../../scraper/nucsoft/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
