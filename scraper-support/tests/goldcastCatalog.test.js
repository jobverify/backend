import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/goldcast/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/goldcast/catalog.js')
  } catch {
    assert.fail('Expected Goldcast catalog module at ../../scraper/goldcast/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/goldcast/script.js')
  } catch {
    assert.fail('Expected Goldcast scraper module at ../../scraper/goldcast/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Goldcast local catalog captures the verified first-party no-public-jobs careers shell', async () => {
  const { GOLDCAST_CATALOG } = await loadCatalogModule()
  const goldcast = await loadScraperModule()
  const provider = buildCatalogReadyProvider(GOLDCAST_CATALOG)

  assert.equal(provider.source, 'goldcast')
  assert.equal(provider.companyName, 'Goldcast')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.goldcast.io/')
  assert.equal(provider.companyCareerPage, 'https://www.goldcast.io/company/careers')
  assert.equal(provider.companyDomain, 'goldcast.io')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-careers-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.goldcast\.io\/company\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers @ Goldcast/i)
  assert.match(provider.verifiedSurfaceSummary, /Stay In Touch/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job cards/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /goldcast[\\/]jobs\.json$/i)

  assert.equal(goldcast.PROVIDER_METADATA.source, provider.source)
  assert.equal(goldcast.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(goldcast.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Goldcast exact backlog row resolves from the local provider contract without aliases', async () => {
  const { GOLDCAST_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Goldcast\n',
    catalog: [buildCatalogReadyProvider(GOLDCAST_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Goldcast', 'goldcast', 'Goldcast']],
  )
})

test('getScraperCatalog includes Goldcast as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'goldcast')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Goldcast')
  assert.equal(provider.companyCareerPage, 'https://www.goldcast.io/company/careers')
  assert.equal(provider.companyDomain, 'goldcast.io')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /goldcast[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Goldcast scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'goldcast')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'goldcast')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /goldcast[\\/]jobs\.json$/i)
})
