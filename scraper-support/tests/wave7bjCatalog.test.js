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

test('AVIZVA local catalog captures the verified first-party careers inventory and Keka apply handoff', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/avizva/catalog.js', 'AVIZVA_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'avizva')
  assert.equal(provider.companyName, 'AVIZVA')
  assert.equal(provider.officialBrandName, 'AVIZVA')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.avizva.com/')
  assert.equal(provider.companyCareerPage, 'https://www.avizva.com/career')
  assert.equal(provider.careersVendorHost, 'avizva.keka.com')
  assert.equal(provider.companyDomain, 'avizva.com')
  assert.equal(provider.atsPlatform, 'keka')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.sourceScope, 'configured-public-board')
  assert.equal(provider.companyGlobalTotal, null)
  assert.equal(provider.companyIndiaTotal, null)
  assert.equal(provider.paginationStrategy, 'current-native-complete-active-array-plus-opening-and-closing-full-details')
  assert.equal(
    provider.extractionStrategy,
    'current-active-corporate-handoffs+literal-native-tenant+reviewed-read-only-client+typed-countries+full-native-criteria+closing-reconciliation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-11-05')
  assert.match(provider.verifiedSurfaceSummary, /Senior Python Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Python Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Visual Product Design/i)
  assert.match(provider.verifiedSurfaceSummary, /avizva\.keka\.com/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'AVIZVA',
    modulePath: path.resolve(currentDir, '../../scraper/avizva/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('CDW local catalog captures the verified first-party job search results and India detail pages', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/cdw/catalog.js', 'CDW_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'cdw')
  assert.equal(provider.companyName, 'CDW')
  assert.equal(provider.officialBrandName, 'CDW')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.cdwjobs.com/')
  assert.equal(provider.companyCareerPage, 'https://www.cdwjobs.com/search/jobs')
  assert.equal(provider.companyDomain, 'cdwjobs.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'server-rendered-search-results-plus-detail-pages-or-blocked-empty-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-search-results-page-or-cloudflare-blocked-shell+verified-india-route-or-blocked-india-route+detail-pages-or-empty-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare "Just a moment\.\.\."/i)
  assert.match(provider.verifiedSurfaceSummary, /search\/jobs\/in\/country\/india/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 403/i)
  assert.match(provider.verifiedSurfaceSummary, /empty sentinel/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'CDW',
    modulePath: path.resolve(currentDir, '../../scraper/cdw/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Maven Wave Partners local catalog captures the linked unfiltered native Jobvite empty inventory', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/mavenwavepartners/catalog.js',
    'MAVEN_WAVE_PARTNERS_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'mavenwavepartners')
  assert.equal(provider.companyName, 'Maven Wave Partners')
  assert.equal(provider.officialBrandName, 'Maven Wave Partners')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mavenwave.com/')
  assert.equal(provider.companyCareerPage, 'https://jobs.jobvite.com/maven-wave-partners/jobs')
  assert.equal(provider.companyDomain, 'mavenwave.com')
  assert.equal(provider.atsPlatform, 'jobvite-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'unfiltered-board-explicit-empty')
  assert.equal(
    provider.extractionStrategy,
    'verified-jobvite-alerts-handoff+unfiltered-branded-openings+explicit-empty-evidence',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /native board/i)
  assert.match(provider.verifiedSurfaceSummary, /Jobvite/i)
  assert.match(provider.verifiedSurfaceSummary, /explicit no-open-jobs/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Maven Wave Partners',
    modulePath: path.resolve(currentDir, '../../scraper/mavenwavepartners/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Vertex Global Services local catalog captures the contradictory careers copy fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/vertexglobalservices/catalog.js',
    'VERTEX_GLOBAL_SERVICES_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'vertexglobalservices')
  assert.equal(provider.companyName, 'Vertex Global Services')
  assert.equal(provider.officialBrandName, 'Vertex Global Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://vertexglobalservices.com/')
  assert.equal(provider.companyCareerPage, 'https://vertexglobalservices.com/about/careers/')
  assert.equal(provider.companyDomain, 'vertexglobalservices.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-contradictory-third-party-copy')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+contradictory-finovate-execor-copy+untrustworthy-open-positions+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Team Unstoppables/i)
  assert.match(provider.verifiedSurfaceSummary, /Finovate/i)
  assert.match(provider.verifiedSurfaceSummary, /execor/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'Vertex Global Services',
    modulePath: path.resolve(currentDir, '../../scraper/vertexglobalservices/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('TRINAMIX local catalog captures the current-openings shell fail-closed contract', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/trinamix/catalog.js', 'TRINAMIX_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'trinamix')
  assert.equal(provider.companyName, 'TRINAMIX')
  assert.equal(provider.officialBrandName, 'Trinamix')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.trinamix.com/')
  assert.equal(provider.companyCareerPage, 'https://careers.trinamix.com/trinamix/')
  assert.equal(provider.companyDomain, 'trinamix.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-shell-with-client-rendered-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+current-openings-search-shell-without-server-rendered-roles+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Innovate with Us/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Submit Your Resume/i)

  assertCatalogMatchesBacklogRow({
    provider,
    companyName: 'TRINAMIX',
    modulePath: path.resolve(currentDir, '../../scraper/trinamix/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
