import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/reddit/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/reddit/catalog.js')
  } catch {
    assert.fail('Expected Reddit catalog module at ../../scraper/reddit/catalog.js')
  }
}

test('Reddit local catalog captures the verified first-party careers page and Greenhouse API surface', async () => {
  const { REDDIT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(REDDIT_CATALOG)

  assert.equal(defaultCatalog, REDDIT_CATALOG)
  assert.equal(provider.source, 'reddit')
  assert.equal(provider.companyName, 'Reddit')
  assert.equal(provider.officialBrandName, 'Reddit')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://redditinc.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://redditinc.com/careers')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/reddit')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/reddit/jobs?content=true',
  )
  assert.equal(provider.companyDomain, 'redditinc.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-greenhouse-links+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /reddit[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/redditinc\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/reddit\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b195\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Reddit'), false)
})

test('Reddit exact backlog row matches directly from the local provider metadata', async () => {
  const { REDDIT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Reddit\n',
    catalog: [hydrateProviderCatalogEntry(REDDIT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Reddit', 'reddit', 'Reddit']],
  )
})

test('Reddit hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { REDDIT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(REDDIT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Reddit')
  assert.equal(provider.companyCareerPage, 'https://redditinc.com/careers')
  assert.equal(provider.companyDomain, 'redditinc.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /reddit[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /reddit[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
