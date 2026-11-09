import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/oyo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/oyo/catalog.js')
  } catch {
    assert.fail('Expected OYO catalog module at ../../scraper/oyo/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/oyo/script.js')
  } catch {
    assert.fail('Expected OYO scraper module at ../../scraper/oyo/script.js')
  }
}

test('OYO local catalog captures the verified exact-name no-first-party-jobs sentinel state', async () => {
  const { OYO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const oyo = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(OYO_CATALOG)

  assert.equal(defaultCatalog, OYO_CATALOG)
  assert.equal(provider.source, 'oyo')
  assert.equal(provider.companyName, 'OYO')
  assert.equal(provider.officialBrandName, 'OYO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.oyorooms.com/')
  assert.equal(provider.companyCareerPage, 'https://www.oyorooms.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.oyorooms.com/careers')
  assert.equal(provider.linkedinCareersUrl, 'https://www.linkedin.com/company/oyo-rooms/jobs/')
  assert.equal(provider.companyDomain, 'oyorooms.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-footer-link-plus-non-jobs-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-linkedin-handoff+verified-non-jobs-careers-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /oyo[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.oyorooms\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.oyorooms\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/company\/oyo-rooms\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy first-party public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OYO'), false)

  assert.equal(oyo.PROVIDER_METADATA.source, OYO_CATALOG.source)
  assert.equal(oyo.PROVIDER_METADATA.companyName, OYO_CATALOG.companyName)
  assert.equal(oyo.PROVIDER_METADATA.linkedinCareersUrl, OYO_CATALOG.linkedinCareersUrl)
})

test('OYO exact backlog row matches directly from local provider metadata', async () => {
  const { OYO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OYO\n',
    catalog: [hydrateProviderCatalogEntry(OYO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OYO', 'oyo', 'OYO']],
  )
})

test('OYO Rooms coverage resolves through the shared OYO provider alias without adding a duplicate scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oyo')

  assert.ok(provider)
  assert.equal(provider.companyName, 'OYO')
  assert.equal(companyAliases['OYO Rooms'], 'oyo')

  const report = generateCompanyCoverageReport({
    csvText: 'OYO\nOYO Rooms\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['OYO', 'oyo', 'OYO'],
      ['OYO Rooms', 'oyo', 'OYO'],
    ],
  )
})

test('getScraperCatalog exposes OYO as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'oyo')
  const scraper = buildScrapers().find((item) => item.name === 'oyo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OYO')
  assert.equal(provider.companyCareerPage, 'https://www.oyorooms.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OYO'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OYO\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OYO', 'oyo', 'OYO']],
  )
})

test('OYO hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { OYO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OYO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'OYO')
  assert.equal(provider.companyCareerPage, 'https://www.oyorooms.com/careers')
  assert.equal(provider.companyDomain, 'oyorooms.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /oyo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /oyo[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
