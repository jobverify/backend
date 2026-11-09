import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const akasaAirModulePath = path.resolve(currentDir, '../../scraper/akasaair/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/akasaair/catalog.js')
  } catch {
    assert.fail('Expected Akasa Air catalog module at ../../scraper/akasaair/catalog.js')
  }
}

const loadAkasaAirModule = async () => {
  try {
    return await import('../../scraper/akasaair/script.js')
  } catch {
    assert.fail('Expected Akasa Air scraper module at ../../scraper/akasaair/script.js')
  }
}

test('Akasa Air local catalog captures the verified first-party careers landing page, role routes, and mixed handoff state', async () => {
  const { AKASA_AIR_CATALOG } = await loadCatalogModule()
  const akasaAir = await loadAkasaAirModule()

  assert.equal(AKASA_AIR_CATALOG.source, 'akasaair')
  assert.equal(AKASA_AIR_CATALOG.companyName, 'Akasa Air')
  assert.equal(AKASA_AIR_CATALOG.officialBrandName, 'Akasa Air')
  assert.equal(AKASA_AIR_CATALOG.adapter, 'script')
  assert.equal(AKASA_AIR_CATALOG.careersRedirectUrl, 'https://www.akasaair.com/careers')
  assert.equal(
    AKASA_AIR_CATALOG.companyCareerPage,
    'https://www.akasaair.com/careers-at-akasa-air/now-hiring',
  )
  assert.equal(AKASA_AIR_CATALOG.companyDomain, 'akasaair.com')
  assert.equal(AKASA_AIR_CATALOG.sitemapUrl, 'https://www.akasaair.com/sitemap.xml')
  assert.deepEqual(AKASA_AIR_CATALOG.rolePageUrls, [
    'https://www.akasaair.com/careers-at-akasa-air/crew-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/pilots-careers-at-akasa-air',
    'https://www.akasaair.com/careers-at-akasa-air/corporate-and-commercial-careers-at-akasa-air',
  ])
  assert.equal(
    AKASA_AIR_CATALOG.brokenPeopleStrongJoblistUrl,
    'https://careers-akasa.peoplestrong.com/job/joblist',
  )
  assert.equal(
    AKASA_AIR_CATALOG.pilotApplyUrl,
    'https://forms.office.com/pages/responsepage.aspx?id=9ZowM48mvkq4Z3pFDULIGiuhPAGD1SNKuPL2TTPwggtUQ0hDTTBJR1hLRlE5R0ZaRVJQSkpUUURFRi4u&route=shorturl',
  )
  assert.equal(AKASA_AIR_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(AKASA_AIR_CATALOG.countryFilter, 'India')
  assert.equal(
    AKASA_AIR_CATALOG.paginationStrategy,
    'verified-first-party-landing-page-plus-sitemap-role-page-discovery',
  )
  assert.equal(
    AKASA_AIR_CATALOG.extractionStrategy,
    'verified-first-party-role-pages+jobposting-schema+working-office-form-handoff+broken-peoplestrong-handoffs-filtered',
  )
  assert.equal(AKASA_AIR_CATALOG.parser, 'custom-script')
  assert.equal(AKASA_AIR_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AKASA_AIR_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(AKASA_AIR_CATALOG.dryRunFile, 'akasaair/jobs.json')
  assert.match(AKASA_AIR_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.akasaair\.com\/careers/i)
  assert.match(
    AKASA_AIR_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.akasaair\.com\/careers-at-akasa-air\/now-hiring/i,
  )
  assert.match(
    AKASA_AIR_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.akasaair\.com\/careers-at-akasa-air\/pilots-careers-at-akasa-air/i,
  )
  assert.match(
    AKASA_AIR_CATALOG.verifiedSurfaceSummary,
    /https:\/\/forms\.office\.com\/pages\/responsepage\.aspx/i,
  )
  assert.match(
    AKASA_AIR_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers-akasa\.peoplestrong\.com\/job\/joblist/i,
  )
  assert.match(AKASA_AIR_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.equal(AKASA_AIR_CATALOG.modulePath, akasaAirModulePath)

  assert.equal(akasaAir.PROVIDER_METADATA.source, AKASA_AIR_CATALOG.source)
  assert.equal(akasaAir.PROVIDER_METADATA.companyName, AKASA_AIR_CATALOG.companyName)
  assert.deepEqual(akasaAir.PROVIDER_METADATA.rolePageUrls, AKASA_AIR_CATALOG.rolePageUrls)
  assert.equal(
    akasaAir.PROVIDER_METADATA.pilotApplyUrl,
    AKASA_AIR_CATALOG.pilotApplyUrl,
  )
})

test('Akasa Air local catalog hydrates into coverage without requiring an alias entry', async () => {
  const { AKASA_AIR_CATALOG } = await loadCatalogModule()
  const hydratedProvider = hydrateProviderCatalogEntry(AKASA_AIR_CATALOG)

  assert.equal(hydratedProvider.companyName, 'Akasa Air')
  assert.equal(hydratedProvider.companyDomain, 'akasaair.com')
  assert.match(hydratedProvider.modulePath, /akasaair[\\/]script\.js$/i)
  assert.match(hydratedProvider.dryRunFile, /akasaair[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akasa Air\n',
    catalog: [hydratedProvider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akasa Air', 'akasaair', 'Akasa Air']],
  )
})

test('buildScrapers and company coverage resolve Akasa Air from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'akasaair')
  const scraper = buildScrapers().find((item) => item.name === 'akasaair')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Akasa Air')
  assert.equal(provider.companyCareerPage, 'https://www.akasaair.com/careers-at-akasa-air/now-hiring')
  assert.match(scraper.dryRunFile, /akasaair[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Akasa Air\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Akasa Air', 'akasaair', 'Akasa Air']],
  )
})
