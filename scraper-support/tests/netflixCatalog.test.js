import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const netflixModulePath = path.resolve(currentDir, '../../scraper/netflix/script.js')

const loadNetflixCatalog = async () => {
  try {
    return await import('../../scraper/netflix/catalog.js')
  } catch {
    assert.fail('Expected Netflix catalog module at ../../scraper/netflix/catalog.js')
  }
}

const loadNetflixModule = async () => {
  try {
    return await import('../../scraper/netflix/script.js')
  } catch {
    assert.fail('Expected Netflix scraper module at ../../scraper/netflix/script.js')
  }
}

test('Netflix local catalog captures the verified Mumbai location page and public explore handoff', async () => {
  const { NETFLIX_CATALOG } = await loadNetflixCatalog()
  const netflix = await loadNetflixModule()
  const provider = hydrateProviderCatalogEntry(NETFLIX_CATALOG)

  assert.equal(provider.source, 'netflix')
  assert.equal(provider.companyName, 'Netflix')
  assert.equal(provider.officialBrandName, 'Netflix')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India')
  assert.equal(provider.exploreJobsBaseUrl, 'https://explore.jobs.netflix.net/careers')
  assert.equal(provider.atsPlatform, 'official-first-party-location-page-plus-public-explore-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-location-handoff-page-with-embedded-position-state')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-location-page+public-explore-positions-state+public-detail-pages+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'jobs.netflix.com')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.dryRunFile, /netflix[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, netflixModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.netflix\.com\/locations\/mumbai/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/explore\.jobs\.netflix\.net\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /5 Mumbai roles|five Mumbai roles/i)
  assert.equal(netflix.PROVIDER_METADATA.source, NETFLIX_CATALOG.source)
  assert.equal(netflix.PROVIDER_METADATA.companyName, NETFLIX_CATALOG.companyName)
  assert.equal(netflix.PROVIDER_METADATA.exploreJobsBaseUrl, NETFLIX_CATALOG.exploreJobsBaseUrl)
})

test('getScraperCatalog includes Netflix as a verified script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'netflix')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Netflix')
  assert.equal(provider.companyCareerPage, 'https://jobs.netflix.com/locations/mumbai?location=Mumbai%2C+India')
  assert.equal(provider.companyDomain, 'jobs.netflix.com')
  assert.equal(provider.atsPlatform, 'official-first-party-location-page-plus-public-explore-board')
  assert.match(provider.modulePath, /netflix[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Netflix scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'netflix')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'netflix')
  assert.equal(scraper.provider.atsPlatform, 'official-first-party-location-page-plus-public-explore-board')
  assert.match(scraper.dryRunFile, /netflix[\\/]jobs\.json$/i)
})
