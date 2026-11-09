import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/klausitsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/klausitsolutions/catalog.js')
  } catch {
    assert.fail('Expected Klaus IT Solutions catalog module at ../../scraper/klausitsolutions/catalog.js')
  }
}

test('Klaus IT Solutions local catalog captures the verified search-shell careers page with no public role rows', async () => {
  const { KLAUS_IT_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(KLAUS_IT_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, KLAUS_IT_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'klausitsolutions')
  assert.equal(provider.companyName, 'Klaus IT Solutions')
  assert.equal(provider.officialBrandName, 'Klaus IT Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://klausit.com/')
  assert.equal(provider.companyCareerPage, 'https://klausit.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://klausit.com/careers/')
  assert.equal(provider.companyDomain, 'klausit.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-shell+myapipage-search-controls-without-public-role-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /klausitsolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /MyApiPage/i)
  assert.match(provider.verifiedSurfaceSummary, /txtsearch/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Klaus IT Solutions'), false)
})

test('Klaus IT Solutions exact backlog row matches from the local catalog entry', async () => {
  const { KLAUS_IT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Klaus IT Solutions\n',
    catalog: [hydrateProviderCatalogEntry(KLAUS_IT_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Klaus IT Solutions', 'klausitsolutions', 'Klaus IT Solutions']],
  )
})

test('Klaus IT Solutions hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { KLAUS_IT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(KLAUS_IT_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://klausit.com/careers/')
  assert.equal(provider.companyDomain, 'klausit.com')
  assert.match(provider.modulePath, /klausitsolutions[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
