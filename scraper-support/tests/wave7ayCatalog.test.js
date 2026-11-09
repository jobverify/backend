import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

test('Zebra Technologies local catalog captures the verified first-party careers handoff to the public Zebra Workday board', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/zebratechnologies.workday/script.js')
  const catalogModule = await loadModule('../../scraper/zebratechnologies.workday/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/zebratechnologies.workday/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.ZEBRA_TECHNOLOGIES_CATALOG)

  assert.equal(catalogModule.default, catalogModule.ZEBRA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'zebratechnologies')
  assert.equal(provider.companyName, 'Zebra Technologies')
  assert.equal(provider.officialBrandName, 'Zebra')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.zebra.com/')
  assert.equal(provider.companyCareerPage, 'https://www.zebra.com/us/en/about-zebra/careers.html')
  assert.equal(provider.officialCareersPageUrl, 'https://www.zebra.com/us/en/about-zebra/careers.html')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://zebra.wd501.myworkdayjobs.com/Zebra_careers')
  assert.equal(provider.companyDomain, 'zebra.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-handoff-plus-workday-india-filter')
  assert.equal(
    provider.extractionStrategy,
    'current-first-party-careers-handoff+full-native-workday-role+reviewed-employer+explicit-own-country+incomplete-source-scope',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.verifiedIndiaCountryFacetId, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.zebra\.com\/us\/en\/about-zebra\/careers\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/zebra\.wd501\.myworkdayjobs\.com\/Zebra_careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer Lead \(IN\/LK\), Professional Senior/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager, Technical Program Management/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /zebratechnologies.workday[\\/]jobs\.json$/i)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Zebra Technologies',
    modulePath,
  })
})

test('Avantha Technologies local catalog captures the parked exact-name domain and fail-closed contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/avanthatechnologies/script.js')
  const catalogModule = await loadModule('../../scraper/avanthatechnologies/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/avanthatechnologies/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.AVANTHA_TECHNOLOGIES_CATALOG)

  assert.equal(catalogModule.default, catalogModule.AVANTHA_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'avanthatechnologies')
  assert.equal(provider.companyName, 'Avantha Technologies')
  assert.equal(provider.officialBrandName, 'Avantha Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://avanthatechnologies.com/')
  assert.equal(provider.companyCareerPage, 'https://avanthatechnologies.com/')
  assert.equal(provider.officialParkedLanderUrl, 'https://avanthatechnologies.com/lander')
  assert.equal(provider.companyDomain, 'avanthatechnologies.com')
  assert.equal(provider.atsPlatform, 'parked-first-party-domain-no-careers-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'root-javascript-redirect-plus-parked-lander-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-root-javascript-redirect+verified-godaddy-parked-lander+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /window\.location\.href="\/lander"/i)
  assert.match(provider.verifiedSurfaceSummary, /window\.LANDER_SYSTEM="PW"/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public careers surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /avanthatechnologies[\\/]jobs\.json$/i)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Avantha Technologies',
    modulePath,
  })
})

test('Systech Solutions local catalog captures the verified exact-name careers page and public embedded jobs API contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/systechsolutions/script.js')
  const catalogModule = await loadModule('../../scraper/systechsolutions/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/systechsolutions/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.SYSTECH_SOLUTIONS_CATALOG)

  assert.equal(catalogModule.default, catalogModule.SYSTECH_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'systechsolutions')
  assert.equal(provider.companyName, 'Systech Solutions')
  assert.equal(provider.officialBrandName, 'Systech Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://systechusa.com/')
  assert.equal(provider.companyCareerPage, 'https://systechusa.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://systechusa.com/careers/')
  assert.equal(
    provider.embeddedJobsListApiUrl,
    'https://prod-171.westus.logic.azure.com:443/workflows/67e48103c49d4bb78d575f18cebb36c1/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=0AvRedg1d2FnScRDeHgN_FJM9mUgKuZaInXLg5Fy_Lc',
  )
  assert.equal(
    provider.embeddedJobsDetailApiUrl,
    'https://prod-125.westus.logic.azure.com:443/workflows/9c049c250c2b4aed831092094d3c61f0/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=O_necFuH-pBhqeGk6KKpYwNEP1f0ax4lxGEPWbZ1kBA',
  )
  assert.equal(provider.usOpeningsPageUrl, 'https://systechusa.com/careers-us/')
  assert.equal(provider.companyDomain, 'systechusa.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-embedded-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-embedded-jobs-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+complete-embedded-jobs-api+explicit-country-validation',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.match(provider.verifiedSurfaceSummary, /public jobs API with one role/i)
  assert.match(provider.verifiedSurfaceSummary, /country remains unknown/i)
  assert.match(provider.verifiedSurfaceSummary, /excluded from India publication/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /systechsolutions[\\/]jobs\.json$/i)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Systech Solutions',
    modulePath,
  })
})

test('NewAge Software & Solutions local catalog captures the verified first-party careers page with inline role cards and modal details', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/newagesoftwareandsolutions/script.js')
  const catalogModule = await loadModule('../../scraper/newagesoftwareandsolutions/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/newagesoftwareandsolutions/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG)

  assert.equal(catalogModule.default, catalogModule.NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'newagesoftwareandsolutions')
  assert.equal(provider.companyName, 'NewAge Software & Solutions')
  assert.equal(provider.officialBrandName, 'NewAge Software & Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.newage-global.com/')
  assert.equal(provider.companyCareerPage, 'https://www.newage-global.com/careers')
  assert.equal(provider.applicationFormUrl, 'https://www.newage-global.com/apply-now')
  assert.equal(provider.companyDomain, 'newage-global.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-inline-listings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-inline-role-details')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-role-cards+inline-modal-role-details+shared-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.newage-global\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Associate/i)
  assert.match(provider.verifiedSurfaceSummary, /Chennai, India/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /newagesoftwareandsolutions[\\/]jobs\.json$/i)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'NewAge Software & Solutions',
    modulePath,
  })
})

test('Maintec Technologies local catalog captures the verified first-party jobs archive and fail-closed no-trustworthy-India-jobs contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/maintectechnologies/script.js')
  const catalogModule = await loadModule('../../scraper/maintectechnologies/catalog.js', 'catalog module')
  const scriptModule = await loadModule('../../scraper/maintectechnologies/script.js', 'scraper module')
  const provider = hydrateProviderCatalogEntry(catalogModule.MAINTEC_TECHNOLOGIES_CATALOG)

  assert.equal(catalogModule.default, catalogModule.MAINTEC_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'maintectechnologies')
  assert.equal(provider.companyName, 'Maintec Technologies')
  assert.equal(provider.officialBrandName, 'Maintec')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://maintec.com/')
  assert.equal(provider.companyCareerPage, 'https://maintec.com/jobs/')
  assert.equal(provider.companyDomain, 'maintec.com')
  assert.equal(provider.atsPlatform, 'first-party-jobs-archive-ambiguous-india-location')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'jobs-archive-plus-representative-detail-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-jobs-archive+us-hours-or-expired-detail-pages+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /CICS System programmer/i)
  assert.match(provider.verifiedSurfaceSummary, /US Eastern hours/i)
  assert.match(provider.verifiedSurfaceSummary, /DB2 System programmer/i)
  assert.match(provider.verifiedSurfaceSummary, /Mainframe DB2 DBA/i)
  assert.match(provider.verifiedSurfaceSummary, /trustworthy India job metadata/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /maintectechnologies[\\/]jobs\.json$/i)
  assert.equal(scriptModule.PROVIDER_METADATA.source, provider.source)

  assertBacklogRowMatches({
    provider,
    companyName: 'Maintec Technologies',
    modulePath,
  })
})

test('Wave 7-AY hydrated local catalogs stay script-runner compatible for centralized integration', async () => {
  const catalogModules = await Promise.all([
    loadModule('../../scraper/zebratechnologies.workday/catalog.js', 'Zebra catalog'),
    loadModule('../../scraper/avanthatechnologies/catalog.js', 'Avantha catalog'),
    loadModule('../../scraper/systechsolutions/catalog.js', 'Systech catalog'),
    loadModule('../../scraper/newagesoftwareandsolutions/catalog.js', 'NewAge catalog'),
    loadModule('../../scraper/maintectechnologies/catalog.js', 'Maintec catalog'),
  ])

  const catalogs = [
    catalogModules[0].ZEBRA_TECHNOLOGIES_CATALOG,
    catalogModules[1].AVANTHA_TECHNOLOGIES_CATALOG,
    catalogModules[2].SYSTECH_SOLUTIONS_CATALOG,
    catalogModules[3].NEWAGE_SOFTWARE_AND_SOLUTIONS_CATALOG,
    catalogModules[4].MAINTEC_TECHNOLOGIES_CATALOG,
  ]

  for (const catalog of catalogs) {
    const provider = hydrateProviderCatalogEntry(catalog)
    const module = await import(pathToFileURL(provider.modulePath).href)

    assert.equal(provider.adapter, 'script')
    assert.equal(provider.countryFilter, 'India')
    assert.equal(typeof module.run, 'function')
    assert.equal(module.PROVIDER_METADATA.source, provider.source)
  }
})
