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

test('QualiZeal local catalog captures the verified anti-bot first-party sentinel contract', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/qualizeal/catalog.js',
    'QUALIZEAL_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'qualizeal')
  assert.equal(provider.companyName, 'QualiZeal')
  assert.equal(provider.officialBrandName, 'QualiZeal')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://qualizeal.com/')
  assert.equal(provider.companyCareerPage, 'https://qualizeal.com/')
  assert.equal(provider.companyDomain, 'qualizeal.com')
  assert.equal(provider.atsPlatform, 'cloudflare-protected-company-site-no-public-jobs-inventory')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-company-site-challenge-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'cloudflare-challenge-detection+no-trustworthy-public-jobs-inventory+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Javascript is required/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs inventory/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'QualiZeal',
    modulePath: path.resolve(currentDir, '../../scraper/qualizeal/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Solera local catalog captures the verified first-party careers page and Workday handoff sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog('../../scraper/solera/catalog.js', 'SOLERA_CATALOG')
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'solera')
  assert.equal(provider.companyName, 'Solera')
  assert.equal(provider.officialBrandName, 'Solera')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.solera.com/')
  assert.equal(provider.companyCareerPage, 'https://www.solera.com/careers/')
  assert.equal(provider.workdayTenantUrl, 'https://solera.wd5.myworkdayjobs.com/Global_Career_Site')
  assert.equal(provider.companyDomain, 'solera.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-linking-to-workday-without-inline-inventory')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-workday-link-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'first-party-careers-copy+workday-link-detection+no-inline-job-inventory+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Revving Up For Growth/i)
  assert.match(provider.verifiedSurfaceSummary, /See Open Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Workday/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Solera',
    modulePath: path.resolve(currentDir, '../../scraper/solera/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Factspan local catalog captures the verified current-openings shell sentinel', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/factspan/catalog.js',
    'FACTSPAN_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'factspan')
  assert.equal(provider.companyName, 'Factspan')
  assert.equal(provider.officialBrandName, 'Factspan')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.factspan.com/')
  assert.equal(provider.companyCareerPage, 'https://www.factspan.com/current-opening-jobs/')
  assert.equal(provider.parentCareersPageUrl, 'https://www.factspan.com/careers/')
  assert.equal(provider.companyDomain, 'factspan.com')
  assert.equal(provider.atsPlatform, 'first-party-current-openings-page-without-public-openings-list')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-openings-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'current-openings-page-detection+no-public-openings-list+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /contact@factspan\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /does not publish a trustworthy/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Factspan',
    modulePath: path.resolve(currentDir, '../../scraper/factspan/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('PubMatic local catalog captures the verified first-party jobs inventory', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/pubmatic/catalog.js',
    'PUBMATIC_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'pubmatic')
  assert.equal(provider.companyName, 'PubMatic')
  assert.equal(provider.officialBrandName, 'PubMatic')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://pubmatic.com/')
  assert.equal(provider.companyCareerPage, 'https://pubmatic.com/careers/job-search/')
  assert.equal(provider.companyDomain, 'pubmatic.com')
  assert.equal(provider.atsPlatform, 'first-party-html-jobs-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-location-grouped-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'first-party-html-location-sections+job-link-extraction+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /62 open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Gurugram, IN/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Performance Advertising Engineer/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'PubMatic',
    modulePath: path.resolve(currentDir, '../../scraper/pubmatic/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})

test('Juego Studio local catalog captures the verified first-party open-positions inventory', async () => {
  const { constant, defaultExport } = await loadCatalog(
    '../../scraper/juegostudio/catalog.js',
    'JUEGO_STUDIO_CATALOG',
  )
  const provider = hydrateProviderCatalogEntry(constant)

  assert.equal(defaultExport, constant)
  assert.equal(provider.source, 'juegostudio')
  assert.equal(provider.companyName, 'Juego Studio')
  assert.equal(provider.officialBrandName, 'Juego Studio')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.juegostudio.com/')
  assert.equal(provider.companyCareerPage, 'https://www.juegostudio.com/careers')
  assert.equal(
    provider.publicApplicationUrl,
    'https://jhub.juegostudio.com/?module=interview&component=application',
  )
  assert.equal(provider.companyDomain, 'juegostudio.com')
  assert.equal(provider.atsPlatform, 'first-party-open-positions-page-with-jhub-application-fallback')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-open-positions-page')
  assert.equal(
    provider.extractionStrategy,
    'first-party-html-opening-sections-or-jhub-application-options+apply-link-extraction+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.verifiedPublicJobCount, 6)
  assert.match(provider.verifiedSurfaceSummary, /OPEN POSITIONS/i)
  assert.match(provider.verifiedSurfaceSummary, /3D Artist I \/ II/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Animator/i)
  assert.match(provider.verifiedSurfaceSummary, /JHub/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Juego Studio',
    modulePath: path.resolve(currentDir, '../../scraper/juegostudio/script.js'),
  })
  await assertHydratedCatalogLoadsScript(provider)
})
