import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const boeingIndiaModulePath = path.resolve(currentDir, '../../scraper/boeingindia/script.js')

const loadBoeingIndiaCatalog = async () => {
  try {
    return await import('../../scraper/boeingindia/catalog.js')
  } catch {
    assert.fail('Expected Boeing India catalog module at ../../scraper/boeingindia/catalog.js')
  }
}

const loadBoeingIndiaModule = async () => {
  try {
    return await import('../../scraper/boeingindia/script.js')
  } catch {
    assert.fail('Expected Boeing India scraper module at ../../scraper/boeingindia/script.js')
  }
}

test('Boeing India local catalog captures the Thursday, August 13, 2026 first-party careers redirect, India search route, and detail-page handoff', async () => {
  const { BOEING_INDIA_CATALOG } = await loadBoeingIndiaCatalog()
  const boeingIndia = await loadBoeingIndiaModule()

  assert.equal(BOEING_INDIA_CATALOG.source, 'boeingindia')
  assert.equal(BOEING_INDIA_CATALOG.companyName, 'Boeing India')
  assert.equal(BOEING_INDIA_CATALOG.officialBrandName, 'Boeing')
  assert.equal(BOEING_INDIA_CATALOG.adapter, 'script')
  assert.equal(BOEING_INDIA_CATALOG.homepageUrl, 'https://www.boeing.com/careers/')
  assert.equal(BOEING_INDIA_CATALOG.careersLandingUrl, 'https://jobs.boeing.com/')
  assert.equal(
    BOEING_INDIA_CATALOG.companyCareerPage,
    'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2',
  )
  assert.equal(
    BOEING_INDIA_CATALOG.searchResultsUrl,
    'https://jobs.boeing.com/search-jobs/India/185/2/1269750/22/79/50/2',
  )
  assert.equal(
    BOEING_INDIA_CATALOG.sampleJobUrl,
    'https://jobs.boeing.com/job/bengaluru/experienced-software-engineer-ui-ux-designer/185/97595724928',
  )
  assert.equal(BOEING_INDIA_CATALOG.companyDomain, 'jobs.boeing.com')
  assert.equal(BOEING_INDIA_CATALOG.atsPlatform, 'talentbrew-radancy')
  assert.equal(BOEING_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(BOEING_INDIA_CATALOG.paginationStrategy, 'page-query')
  assert.equal(
    BOEING_INDIA_CATALOG.extractionStrategy,
    'verified-careers-redirect+india-search-results+detail-pages+workday-apply-handoff',
  )
  assert.equal(BOEING_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(BOEING_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(BOEING_INDIA_CATALOG.verifiedOn, '2026-08-13')
  assert.equal(BOEING_INDIA_CATALOG.dryRunFile, 'boeingindia/jobs.json')
  assert.match(BOEING_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.boeing\.com\/careers\//i)
  assert.match(BOEING_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.boeing\.com\//i)
  assert.match(
    BOEING_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jobs\.boeing\.com\/search-jobs\/India\/185\/2\/1269750\/22\/79\/50\/2/i,
  )
  assert.match(
    BOEING_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/jobs\.boeing\.com\/job\/bengaluru\/experienced-software-engineer-ui-ux-designer\/185\/97595724928/i,
  )
  assert.match(BOEING_INDIA_CATALOG.verifiedSurfaceSummary, /0 results found in India/i)
  assert.match(BOEING_INDIA_CATALOG.verifiedSurfaceSummary, /Workday/i)
  assert.equal(BOEING_INDIA_CATALOG.modulePath, boeingIndiaModulePath)

  assert.equal(boeingIndia.PROVIDER_METADATA.source, BOEING_INDIA_CATALOG.source)
  assert.equal(boeingIndia.PROVIDER_METADATA.companyName, BOEING_INDIA_CATALOG.companyName)
  assert.equal(boeingIndia.PROVIDER_METADATA.searchResultsUrl, BOEING_INDIA_CATALOG.searchResultsUrl)
})

test('Boeing India backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { BOEING_INDIA_CATALOG } = await loadBoeingIndiaCatalog()
  const provider = hydrateProviderCatalogEntry(BOEING_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Boeing India')
  assert.equal(provider.companyDomain, 'jobs.boeing.com')
  assert.match(provider.modulePath, /boeingindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /boeingindia[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Boeing India'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Boeing India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Boeing India', 'boeingindia', 'Boeing India']],
  )
})
