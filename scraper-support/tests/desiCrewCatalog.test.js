import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const desiCrewModulePath = path.resolve(currentDir, '../../scraper/desicrew/script.js')

const loadDesiCrewCatalog = async () => {
  try {
    return await import('../../scraper/desicrew/catalog.js')
  } catch {
    assert.fail('Expected Desi Crew catalog module at ../../scraper/desicrew/catalog.js')
  }
}

const loadDesiCrewModule = async () => {
  try {
    return await import('../../scraper/desicrew/script.js')
  } catch {
    assert.fail('Expected Desi Crew scraper module at ../../scraper/desicrew/script.js')
  }
}

test('Desi Crew local catalog captures the August 15, 2026 first-party careers site contract', async () => {
  const { DESI_CREW_CATALOG } = await loadDesiCrewCatalog()
  const desiCrew = await loadDesiCrewModule()

  assert.equal(DESI_CREW_CATALOG.source, 'desicrew')
  assert.equal(DESI_CREW_CATALOG.companyName, 'Desi Crew')
  assert.equal(DESI_CREW_CATALOG.officialBrandName, 'DesiCrew')
  assert.equal(DESI_CREW_CATALOG.adapter, 'script')
  assert.equal(DESI_CREW_CATALOG.homepageUrl, 'https://www.desicrew.in/')
  assert.equal(DESI_CREW_CATALOG.careersPageUrl, 'https://www.desicrew.in/careers/')
  assert.equal(DESI_CREW_CATALOG.companyCareerPage, 'https://www.desicrew.in/careers/')
  assert.equal(DESI_CREW_CATALOG.jobsArchiveUrl, 'https://www.desicrew.in/careers/')
  assert.equal(DESI_CREW_CATALOG.jobsApiUrl, null)
  assert.equal(
    DESI_CREW_CATALOG.sampleJobUrl,
    'https://www.desicrew.in/careers/qa-automation-engineer/',
  )
  assert.equal(DESI_CREW_CATALOG.companyDomain, 'desicrew.in')
  assert.equal(DESI_CREW_CATALOG.atsPlatform, 'first-party-desicrew-careers-site')
  assert.equal(DESI_CREW_CATALOG.countryFilter, 'India')
  assert.equal(
    DESI_CREW_CATALOG.paginationStrategy,
    'single-first-party-careers-page-plus-role-detail-pages',
  )
  assert.equal(
    DESI_CREW_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+first-party-role-index+first-party-role-detail-pages-with-jobposting-metadata',
  )
  assert.equal(DESI_CREW_CATALOG.parser, 'custom-script')
  assert.equal(DESI_CREW_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DESI_CREW_CATALOG.verifiedOn, '2026-08-15')
  assert.equal(DESI_CREW_CATALOG.dryRunFile, 'desicrew/jobs.json')
  assert.equal(DESI_CREW_CATALOG.modulePath, desiCrewModulePath)
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.desicrew\.in\//i)
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.desicrew\.in\/careers\//i)
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /open-job-positions\/ endpoint redirects/i)
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /WordPress REST endpoint is no longer a usable public jobs source/i)
  assert.match(
    DESI_CREW_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.desicrew\.in\/careers\/qa-automation-engineer\//i,
  )
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /JobPosting metadata/i)
  assert.match(DESI_CREW_CATALOG.verifiedSurfaceSummary, /inline apply form directly on-page/i)

  assert.equal(desiCrew.PROVIDER_METADATA.source, DESI_CREW_CATALOG.source)
  assert.equal(desiCrew.PROVIDER_METADATA.companyName, DESI_CREW_CATALOG.companyName)
  assert.equal(desiCrew.PROVIDER_METADATA.companyCareerPage, DESI_CREW_CATALOG.companyCareerPage)
  assert.equal(desiCrew.PROVIDER_METADATA.jobsApiUrl, DESI_CREW_CATALOG.jobsApiUrl)
})

test('Desi Crew backlog row hydrates locally without needing an alias entry', async () => {
  const { DESI_CREW_CATALOG } = await loadDesiCrewCatalog()
  const provider = hydrateProviderCatalogEntry(DESI_CREW_CATALOG)

  assert.equal(provider.companyName, 'Desi Crew')
  assert.equal(provider.companyDomain, 'desicrew.in')
  assert.match(provider.modulePath, /desicrew[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /desicrew[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Desi Crew'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Desi Crew\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Desi Crew', 'desicrew', 'Desi Crew']],
  )
})

test('buildScrapers and company coverage resolve Desi Crew from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'desicrew')
  const scraper = buildScrapers().find((item) => item.name === 'desicrew')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Desi Crew')
  assert.match(provider.modulePath, /desicrew[\\/]script\.js$/i)
  assert.match(scraper.dryRunFile, /desicrew[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Desi Crew\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Desi Crew', 'desicrew', 'Desi Crew']],
  )
})
