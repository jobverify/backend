import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/firefliesai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/firefliesai/catalog.js')
  } catch {
    assert.fail('Expected Fireflies.ai catalog module at ../../scraper/firefliesai/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/firefliesai/script.js')
  } catch {
    assert.fail('Expected Fireflies.ai scraper module at ../../scraper/firefliesai/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Fireflies.ai local catalog captures the verified first-party careers redirect and Gem public jobs contract', async () => {
  const {
    FIREFLIES_AI_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const firefliesAi = await loadScraperModule()
  const provider = buildCatalogReadyProvider(FIREFLIES_AI_CATALOG)

  assert.equal(provider.source, 'firefliesai')
  assert.equal(provider.companyName, 'Fireflies.ai')
  assert.equal(provider.officialBrandName, 'Fireflies.ai')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(FIREFLIES_AI_CATALOG.dryRunFile, 'firefliesai/jobs.json')
  assert.match(provider.dryRunFile, /firefliesai[\\/]jobs\.json$/i)
  assert.equal(provider.officialHomepageUrl, 'https://fireflies.ai/')
  assert.equal(provider.companyCareerPage, 'https://fireflies.ai/careers')
  assert.equal(provider.officialGemBoardUrl, 'https://jobs.gem.com/fireflies')
  assert.equal(provider.graphqlApiUrl, 'https://jobs.gem.com/api/public/graphql')
  assert.equal(
    provider.gemBoardBundleUrl,
    'https://static.gem.com/scripts/jobBoards.BzUgVe52.v2.min.js',
  )
  assert.equal(provider.gemBoardTrackingId, '3eab0d5a-721b-4989-89f1-f95971c662ff')
  assert.equal(provider.verifiedPublicPostingCount, 8)
  assert.equal(provider.verifiedIndiaRoleCount, 5)
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3',
  )
  assert.equal(
    provider.verifiedSampleApplyUrl,
    'https://jobs.gem.com/fireflies/am9icG9zdDqXUtqNK-Y5LIdSxQYHLBn3/application',
  )
  assert.equal(provider.atsPlatform, 'gem')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-graphql-job-board-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-redirect+verified-gem-board-shell+public-graphql-list-query+public-graphql-detail-query+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fireflies\.ai\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.gem\.com\/fireflies/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.gem\.com\/api\/public\/graphql/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /8 public postings/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /5 India roles/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Mumbai/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Bengaluru/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Chennai/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Pune/i)

  assert.equal(firefliesAi.PROVIDER_METADATA.source, provider.source)
  assert.equal(firefliesAi.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(firefliesAi.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(firefliesAi.PROVIDER_METADATA.graphqlApiUrl, provider.graphqlApiUrl)
})

test('Fireflies.ai exact backlog row matches from the local provider contract without aliases', async () => {
  const { FIREFLIES_AI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Fireflies.ai\n',
    catalog: [buildCatalogReadyProvider(FIREFLIES_AI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fireflies.ai', 'firefliesai', 'Fireflies.ai']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Fireflies.ai'), false)
})
