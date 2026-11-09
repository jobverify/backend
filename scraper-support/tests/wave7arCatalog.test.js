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
  assert.equal(provider.modulePath, modulePath)

  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[companyName, provider.source, companyName]],
  )
}

const assertHydratedCatalogLoadsScript = async (provider) => {
  const module = await import(pathToFileURL(provider.modulePath).href)
  assert.equal(typeof module.run, 'function')
}

test('Techved Consulting local catalog captures the verified first-party ASP.NET careers page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/techvedconsulting/catalog.js',
    'TECHVED_CONSULTING_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'techvedconsulting')
  assert.equal(provider.companyName, 'Techved Consulting')
  assert.equal(provider.officialBrandName, 'TECHVED Consulting India Pvt. Ltd.')
  assert.equal(provider.homepageUrl, 'https://www.techved.com/')
  assert.equal(provider.companyCareerPage, 'https://www.techved.com/me/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-aspnet-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-job-cards+same-page-detail-panels',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /All Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr Marketing Associate/i)
  assert.match(provider.verifiedSurfaceSummary, /UX Designer/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Techved Consulting',
    modulePath: path.resolve(currentDir, '../../scraper/techvedconsulting/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Nxtgen Datacenter Cloud Technologies local catalog captures the verified first-party featured jobs page', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/nxtgendatacentercloudtechnologies/catalog.js',
    'NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'nxtgendatacentercloudtechnologies')
  assert.equal(provider.companyName, 'Nxtgen Datacenter Cloud Technologies')
  assert.equal(provider.officialBrandName, 'NxtGen Datacenter & Cloud Technologies')
  assert.equal(provider.homepageUrl, 'https://nxtgen.co.in/')
  assert.equal(provider.companyCareerPage, 'https://nxtgen.co.in/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-static-featured-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+visible-featured-job-cards+same-page-apply-modals+pdf-detail-links',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.verifiedSurfaceSummary, /Featured Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Life Cycle Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Priority Support Consultant - Compute/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Nxtgen Datacenter Cloud Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/nxtgendatacentercloudtechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Technosoft Corporation local catalog captures the exact-name fail-closed redirect state', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/technosoftcorporation/catalog.js',
    'TECHNOSOFT_CORPORATION_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'technosoftcorporation')
  assert.equal(provider.companyName, 'Technosoft Corporation')
  assert.equal(provider.officialBrandName, 'Technosoft Corporation')
  assert.equal(provider.homepageUrl, 'http://www.technosoftcorp.com/')
  assert.equal(provider.companyCareerPage, 'http://www.technosoftcorp.com/')
  assert.equal(provider.legacyRedirectUrl, 'https://www.apexon.com/')
  assert.equal(provider.atsPlatform, 'legacy-domain-redirect-no-public-jobs')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'legacy-homepage-redirect-plus-common-careers-404-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-legacy-homepage-redirect+verified-empty-first-party-careers-routes+no-exact-name-public-jobs',
  )
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /Technosoft is now Apexon/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy exact-name public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /http:\/\/www\.technosoftcorp\.com\/careers/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Technosoft Corporation',
    modulePath: path.resolve(currentDir, '../../scraper/technosoftcorporation/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Infrabeat Technologies local catalog captures the verified first-party WordPress careers archive', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/infrabeattechnologies/catalog.js',
    'INFRABEAT_TECHNOLOGIES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'infrabeattechnologies')
  assert.equal(provider.companyName, 'Infrabeat Technologies')
  assert.equal(provider.officialBrandName, 'InfraBeat Technologies Pvt. Ltd.')
  assert.equal(provider.homepageUrl, 'https://infrabeat.com/')
  assert.equal(provider.companyCareerPage, 'https://infrabeat.com/careers/')
  assert.equal(provider.atsPlatform, 'official-inline-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-inline-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-open-position-cards+modal-job-details',
  )
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead SAP MM Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead SAP FICO Consultant/i)
  assert.match(provider.verifiedSurfaceSummary, /SAP FICO Senior Consultant/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Infrabeat Technologies',
    modulePath: path.resolve(currentDir, '../../scraper/infrabeattechnologies/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Techila Global Services local catalog captures the verified first-party Next.js careers board', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/techilaglobalservices/catalog.js',
    'TECHILA_GLOBAL_SERVICES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'techilaglobalservices')
  assert.equal(provider.companyName, 'Techila Global Services')
  assert.equal(provider.officialBrandName, 'Techila Global Services')
  assert.equal(provider.homepageUrl, 'https://techilaservices.com/')
  assert.equal(provider.companyCareerPage, 'https://techilaservices.com/careers')
  assert.equal(provider.atsPlatform, 'nextjs-jobposting-detail-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'server-rendered-job-list-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-open-roles-list+detail-pages+jobposting-jsonld+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Current openings/i)
  assert.match(provider.verifiedSurfaceSummary, /196 positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Scientist/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Techila Global Services',
    modulePath: path.resolve(currentDir, '../../scraper/techilaglobalservices/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
