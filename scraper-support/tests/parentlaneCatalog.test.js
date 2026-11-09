import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const parentlaneModulePath = path.resolve(currentDir, '../../scraper/parentlane/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/parentlane/catalog.js')
  } catch {
    assert.fail('Expected Parentlane catalog module at ../../scraper/parentlane/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/parentlane/script.js')
  } catch {
    assert.fail('Expected Parentlane scraper module at ../../scraper/parentlane/script.js')
  }
}

test('Parentlane local catalog captures the verified exact-name no-public-jobs surface without alias churn', async () => {
  const { PARENTLANE_CATALOG } = await loadCatalogModule()
  const parentlane = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PARENTLANE_CATALOG)

  assert.equal(provider.source, 'parentlane')
  assert.equal(provider.companyName, 'Parentlane')
  assert.equal(provider.officialBrandName, 'Parentlane')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.parentlane.com/')
  assert.equal(provider.companyCareerPage, 'https://www.parentlane.com/aboutus.html')
  assert.equal(provider.verifiedMissingCareersRouteUrl, 'https://www.parentlane.com/careers')
  assert.equal(provider.officialSupportEmail, 'info@parentlane.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-and-about-page-plus-missing-careers-route',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage+about-page+404-careers-route+self-signed-tls-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'parentlane.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /parentlane[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, parentlaneModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.parentlane\.com\/aboutus\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.parentlane\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /self-signed certificate/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Parentlane'), false)

  assert.equal(parentlane.PROVIDER_METADATA.source, PARENTLANE_CATALOG.source)
  assert.equal(parentlane.PROVIDER_METADATA.companyName, PARENTLANE_CATALOG.companyName)
  assert.equal(
    parentlane.PROVIDER_METADATA.verifiedMissingCareersRouteUrl,
    PARENTLANE_CATALOG.verifiedMissingCareersRouteUrl,
  )
})

test('Parentlane backlog row matches directly from the local catalog without alias churn', async () => {
  const { PARENTLANE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Parentlane\n',
    catalog: [hydrateProviderCatalogEntry(PARENTLANE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Parentlane', 'parentlane', 'Parentlane']],
  )
})

test('getScraperCatalog exposes Parentlane as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'parentlane')
  const scraper = buildScrapers().find((item) => item.name === 'parentlane')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Parentlane')
  assert.equal(provider.companyCareerPage, 'https://www.parentlane.com/aboutus.html')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Parentlane'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Parentlane\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Parentlane', 'parentlane', 'Parentlane']],
  )
})
