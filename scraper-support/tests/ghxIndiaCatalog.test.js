import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ghxIndiaModulePath = path.resolve(currentDir, '../../scraper/ghxindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ghxindia/catalog.js')
  } catch {
    assert.fail('Expected GHX India catalog module at ../../scraper/ghxindia/catalog.js')
  }
}

const loadGhxIndiaModule = async () => {
  try {
    return await import('../../scraper/ghxindia/script.js')
  } catch {
    assert.fail('Expected GHX India scraper module at ../../scraper/ghxindia/script.js')
  }
}

test('GHX India local catalog captures the verified GHX careers handoff and Greenhouse India jobs surface without aliases', async () => {
  const { GHX_INDIA_CATALOG } = await loadCatalogModule()
  const ghxIndia = await loadGhxIndiaModule()
  const provider = hydrateProviderCatalogEntry(GHX_INDIA_CATALOG)

  assert.equal(provider.source, 'ghxindia')
  assert.equal(provider.companyName, 'GHX India')
  assert.equal(provider.officialBrandName, 'GHX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ghx.com/about/careers/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/globalhealthcareexchangeinc')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/globalhealthcareexchangeinc/jobs',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+greenhouse-jobs-api+greenhouse-public-detail-urls+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ghx.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /ghxindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ghx\.com\/about\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/globalhealthcareexchangeinc/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer II/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer/i)
  assert.equal(provider.modulePath, ghxIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GHX India'), false)

  assert.equal(ghxIndia.PROVIDER_METADATA.source, GHX_INDIA_CATALOG.source)
  assert.equal(ghxIndia.PROVIDER_METADATA.companyName, GHX_INDIA_CATALOG.companyName)
  assert.equal(
    ghxIndia.PROVIDER_METADATA.greenhouseJobsApiUrl,
    GHX_INDIA_CATALOG.greenhouseJobsApiUrl,
  )
})

test('GHX India backlog row matches directly from the local catalog without alias churn', async () => {
  const { GHX_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GHX India\n',
    catalog: [hydrateProviderCatalogEntry(GHX_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GHX India', 'ghxindia', 'GHX India']],
  )
})

test('getScraperCatalog includes GHX India as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ghxindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GHX India')
  assert.equal(provider.companyCareerPage, 'https://www.ghx.com/about/careers/')
  assert.equal(provider.companyDomain, 'ghx.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /ghxindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GHX India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ghxindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ghxindia')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /ghxindia[\\/]jobs\.json$/i)
})
