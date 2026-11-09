import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const nkModulePath = path.resolve(currentDir, '../../scraper/nksecurities/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nksecurities/catalog.js')
  } catch {
    assert.fail('Expected NK Securities catalog module at ../../scraper/nksecurities/catalog.js')
  }
}

test('NK Securities catalog captures the verified first-party Greenhouse jobs surface', async () => {
  const {
    NK_SECURITIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NK_SECURITIES_CATALOG)

  assert.equal(defaultCatalog, NK_SECURITIES_CATALOG)
  assert.equal(provider.source, 'nksecurities')
  assert.equal(provider.companyName, 'NK Securities')
  assert.equal(provider.officialBrandName, 'NK Securities Research')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nksecurities.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nksecurities.com/open-positions.html')
  assert.equal(provider.companyDomain, 'nksecurities.com')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://api.greenhouse.io/v1/boards/nksecuritiesresearch/jobs')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.eu.greenhouse.io/nksecuritiesresearch')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-open-positions-page-plus-greenhouse-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-open-positions-page+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nksecurities\.com\/open-positions\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.greenhouse\.io\/v1\/boards\/nksecuritiesresearch\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /17 public postings/i)
  assert.equal(provider.modulePath, nkModulePath)
  assert.match(provider.dryRunFile, /nksecurities[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NK Securities'), false)
})

test('NK Securities backlog row matches directly from the local catalog metadata', async () => {
  const { NK_SECURITIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NK Securities\n',
    catalog: [NK_SECURITIES_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NK Securities', 'nksecurities', 'NK Securities']],
  )
})
