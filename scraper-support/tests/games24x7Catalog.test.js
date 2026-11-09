import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const games24x7ModulePath = path.resolve(currentDir, '../../scraper/games24x7/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/games24x7/catalog.js')
  } catch {
    assert.fail('Expected Games24x7 catalog module at ../../scraper/games24x7/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/games24x7/script.js')
  } catch {
    assert.fail('Expected Games24x7 scraper module at ../../scraper/games24x7/script.js')
  }
}

test('Games24x7 local catalog captures the verified first-party Darwinbox-backed careers surface', async () => {
  const { GAMES24X7_CATALOG } = await loadCatalogModule()
  const games24x7 = await loadScriptModule()

  assert.equal(GAMES24X7_CATALOG.source, 'games24x7')
  assert.equal(GAMES24X7_CATALOG.companyName, 'Games24x7')
  assert.equal(GAMES24X7_CATALOG.officialBrandName, 'Games24x7')
  assert.equal(GAMES24X7_CATALOG.adapter, 'script')
  assert.equal(GAMES24X7_CATALOG.homepageUrl, 'https://www.games24x7.com/')
  assert.equal(GAMES24X7_CATALOG.redirectedHomepageUrl, 'https://www.games24x7.com/')
  assert.equal(GAMES24X7_CATALOG.companyCareerPage, 'https://www.games24x7.com/life')
  assert.equal(
    GAMES24X7_CATALOG.officialCareersHandoffUrl,
    'https://games24x7.darwinbox.in/ms/candidate/a6150564417204/careers',
  )
  assert.equal(GAMES24X7_CATALOG.darwinboxOrigin, 'https://games24x7.darwinbox.in')
  assert.equal(GAMES24X7_CATALOG.darwinboxCompanyId, 'a6150564417204')
  assert.equal(GAMES24X7_CATALOG.companyDomain, 'games24x7.com')
  assert.equal(GAMES24X7_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(GAMES24X7_CATALOG.countryFilter, 'India')
  assert.equal(
    GAMES24X7_CATALOG.paginationStrategy,
    'browser-session-darwinbox-pagination',
  )
  assert.equal(
    GAMES24X7_CATALOG.extractionStrategy,
    'official-life-page+darwinbox-listing-api',
  )
  assert.equal(GAMES24X7_CATALOG.parser, 'custom-script')
  assert.equal(GAMES24X7_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GAMES24X7_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(GAMES24X7_CATALOG.dryRunFile, 'games24x7/jobs.json')
  assert.equal(GAMES24X7_CATALOG.modulePath, games24x7ModulePath)
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /https:\/\/games24x7\.com\//i)
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.games24x7\.com\//i)
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.games24x7\.com\/life/i)
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /120 million \+/i)
  assert.match(
    GAMES24X7_CATALOG.verifiedSurfaceSummary,
    /https:\/\/games24x7\.darwinbox\.in\/ms\/candidate\/a6150564417204\/careers/i,
  )
  assert.match(
    GAMES24X7_CATALOG.verifiedSurfaceSummary,
    /https:\/\/games24x7\.darwinbox\.in\/ms\/candidatev2\/a6150564417204\/careers\/allJobs/i,
  )
  assert.match(
    GAMES24X7_CATALOG.verifiedSurfaceSummary,
    /https:\/\/games24x7\.darwinbox\.in\/ms\/candidateapi\/job\/alljobs\?companyId=a6150564417204/i,
  )
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /re-confirmed/i)
  assert.match(GAMES24X7_CATALOG.verifiedSurfaceSummary, /browser-session Darwinbox pagination pattern/i)

  assert.equal(games24x7.PROVIDER_METADATA.source, GAMES24X7_CATALOG.source)
  assert.equal(games24x7.PROVIDER_METADATA.companyName, GAMES24X7_CATALOG.companyName)
  assert.equal(
    games24x7.PROVIDER_METADATA.officialCareersHandoffUrl,
    GAMES24X7_CATALOG.officialCareersHandoffUrl,
  )
  assert.equal(
    games24x7.PROVIDER_METADATA.darwinboxOrigin,
    GAMES24X7_CATALOG.darwinboxOrigin,
  )
})

test('Games24x7 backlog row hydrates locally from the local provider contract', async () => {
  const { GAMES24X7_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GAMES24X7_CATALOG)

  assert.equal(provider.companyName, 'Games24x7')
  assert.equal(provider.companyDomain, 'games24x7.com')
  assert.match(provider.modulePath, /games24x7[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /games24x7[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Games24x7\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Games24x7', 'games24x7', 'Games24x7']],
  )
})
