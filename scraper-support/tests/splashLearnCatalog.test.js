import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/splashlearn/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/splashlearn/catalog.js')
  } catch {
    assert.fail('Expected SplashLearn catalog module at ../../scraper/splashlearn/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/splashlearn/script.js')
  } catch {
    assert.fail('Expected SplashLearn scraper module at ../../scraper/splashlearn/script.js')
  }
}

test('SplashLearn local catalog captures the verified first-party careers page sentinel without alias churn', async () => {
  const { SPLASHLEARN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const splashLearn = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SPLASHLEARN_CATALOG)

  assert.equal(defaultCatalog, SPLASHLEARN_CATALOG)
  assert.equal(provider.source, 'splashlearn')
  assert.equal(provider.companyName, 'SplashLearn')
  assert.equal(provider.officialBrandName, 'SplashLearn')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.splashlearn.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.splashlearn.com/careers')
  assert.equal(provider.companyDomain, 'splashlearn.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-verified-careers-page-no-public-jobs-surface')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+no-public-jobs-signal+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.match(provider.dryRunFile, /splashlearn[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.splashlearn\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers at SplashLearn/i)
  assert.match(provider.verifiedSurfaceSummary, /Arpit Jain/i)
  assert.match(provider.verifiedSurfaceSummary, /StudyPad, Inc/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SplashLearn'), false)

  assert.equal(splashLearn.PROVIDER_METADATA.source, SPLASHLEARN_CATALOG.source)
  assert.equal(splashLearn.PROVIDER_METADATA.companyName, SPLASHLEARN_CATALOG.companyName)
})

test('SplashLearn exact backlog row matches directly from the local provider metadata', async () => {
  const { SPLASHLEARN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SplashLearn\n',
    catalog: [hydrateProviderCatalogEntry(SPLASHLEARN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SplashLearn', 'splashlearn', 'SplashLearn']],
  )
})

test('SplashLearn hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SPLASHLEARN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SPLASHLEARN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SplashLearn')
  assert.equal(provider.companyCareerPage, 'https://www.splashlearn.com/careers')
  assert.equal(provider.companyDomain, 'splashlearn.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-no-public-jobs')
  assert.match(provider.modulePath, /splashlearn[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /splashlearn[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
