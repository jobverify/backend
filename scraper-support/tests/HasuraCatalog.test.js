import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hasura/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hasura/catalog.js')
  } catch {
    assert.fail('Expected Hasura catalog module at ../../scraper/hasura/catalog.js')
  }
}

const loadHasuraModule = async () => {
  try {
    return await import('../../scraper/hasura/script.js')
  } catch {
    assert.fail('Expected Hasura scraper module at ../../scraper/hasura/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Hasura local catalog captures the verified Hasura-to-PromptQL careers redirect and Gem India jobs surface', async () => {
  const { HASURA_CATALOG } = await loadCatalogModule()
  const hasura = await loadHasuraModule()
  const provider = buildCatalogReadyProvider(HASURA_CATALOG)

  assert.equal(provider.source, 'hasura')
  assert.equal(provider.companyName, 'Hasura')
  assert.equal(provider.officialBrandName, 'PromptQL')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://hasura.io/careers/')
  assert.equal(provider.redirectedCareersPageUrl, 'https://promptql.io/careers')
  assert.equal(provider.officialGemBoardUrl, 'https://jobs.gem.com/promptql')
  assert.equal(provider.graphqlApiUrl, 'https://jobs.gem.com/api/public/graphql')
  assert.equal(
    provider.gemBoardBundleUrl,
    'https://static.gem.com/scripts/jobBoards.BpHUFx-E.v2.min.js',
  )
  assert.equal(provider.gemBoardTrackingId, '4a76acaa-70ac-4e16-bedb-d4426e6a9d3c')
  assert.equal(provider.atsPlatform, 'gem')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-graphql-job-board-query')
  assert.equal(
    provider.extractionStrategy,
    'verified-hasura-careers-redirect+verified-gem-board-shell+public-graphql-list-query+public-graphql-detail-query+india-location-filter+talent-community-exclusion',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.gem.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.verifiedPublicPostingCount, 5)
  assert.equal(provider.verifiedIndiaScopedPostingCount, 2)
  assert.equal(provider.verifiedIndiaActionableRoleCount, 1)
  assert.match(provider.dryRunFile, /hasura[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hasura\.io\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/promptql\.io\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.gem\.com\/promptql/i)
  assert.match(provider.verifiedSurfaceSummary, /Forward Deployed Analyst, Bangalore/i)
  assert.equal(provider.modulePath, modulePath)

  assert.equal(hasura.PROVIDER_METADATA.source, HASURA_CATALOG.source)
  assert.equal(hasura.PROVIDER_METADATA.companyName, HASURA_CATALOG.companyName)
  assert.equal(hasura.PROVIDER_METADATA.graphqlApiUrl, HASURA_CATALOG.graphqlApiUrl)
})

test('Hasura exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { HASURA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hasura\n',
    catalog: [buildCatalogReadyProvider(HASURA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hasura', 'hasura', 'Hasura']],
  )
})

test('getScraperCatalog includes Hasura as a verified Gem-backed provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hasura')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hasura')
  assert.equal(provider.companyCareerPage, 'https://hasura.io/careers/')
  assert.equal(provider.companyDomain, 'jobs.gem.com')
  assert.equal(provider.atsPlatform, 'gem')
  assert.match(provider.modulePath, /hasura[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hasura scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hasura')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hasura')
  assert.equal(scraper.provider.atsPlatform, 'gem')
  assert.match(scraper.dryRunFile, /hasura[\\/]jobs\.json$/i)
})
