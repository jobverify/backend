import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/secpod/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/secpod/catalog.js')
  } catch {
    assert.fail('Expected SecPod catalog module at ../../scraper/secpod/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/secpod/script.js')
  } catch {
    assert.fail('Expected SecPod scraper module at ../../scraper/secpod/script.js')
  }
}

test('SecPod local catalog captures the verified first-party careers page with no trustworthy public jobs surface without alias churn', async () => {
  const { SECPOD_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const secpod = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SECPOD_CATALOG)

  assert.equal(defaultCatalog, SECPOD_CATALOG)
  assert.equal(provider.source, 'secpod')
  assert.equal(provider.companyName, 'SecPod')
  assert.equal(provider.officialBrandName, 'SecPod')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.secpod.com/')
  assert.equal(provider.companyCareerPage, 'https://www.secpod.com/careers')
  assert.equal(provider.companyDomain, 'secpod.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-empty-openings-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-empty-current-openings-section+no-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /secpod[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.secpod\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job listings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SecPod'), false)

  assert.equal(secpod.PROVIDER_METADATA.source, SECPOD_CATALOG.source)
  assert.equal(secpod.PROVIDER_METADATA.companyName, SECPOD_CATALOG.companyName)
  assert.equal(secpod.PROVIDER_METADATA.companyCareerPage, SECPOD_CATALOG.companyCareerPage)
})

test('SecPod backlog row matches directly from the local catalog without alias churn', async () => {
  const { SECPOD_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SecPod\n',
    catalog: [hydrateProviderCatalogEntry(SECPOD_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SecPod', 'secpod', 'SecPod']],
  )
})

test('SecPod hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SECPOD_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SECPOD_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SecPod')
  assert.equal(provider.companyCareerPage, 'https://www.secpod.com/careers')
  assert.equal(provider.companyDomain, 'secpod.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.match(provider.modulePath, /secpod[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /secpod[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
