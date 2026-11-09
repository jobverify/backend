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
const modulePath = path.resolve(currentDir, '../../scraper/olxgroup/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/olxgroup/catalog.js')
  } catch {
    assert.fail('Expected OLX Group catalog module at ../../scraper/olxgroup/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/olxgroup/script.js')
  } catch {
    assert.fail('Expected OLX Group scraper module at ../../scraper/olxgroup/script.js')
  }
}

test('OLX Group local catalog captures the verified official careers handoff to the public Lever board', async () => {
  const { OLX_GROUP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const olxGroup = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(OLX_GROUP_CATALOG)

  assert.equal(defaultCatalog, OLX_GROUP_CATALOG)
  assert.equal(provider.source, 'olxgroup')
  assert.equal(provider.companyName, 'OLX Group')
  assert.equal(provider.officialBrandName, 'OLX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.olxgroup.com/jobs/')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.olxgroup.com/jobs/')
  assert.equal(provider.leverBoardUrl, 'https://jobs.eu.lever.co/olx')
  assert.equal(provider.leverApiUrl, 'https://api.eu.lever.co/v0/postings/olx?mode=json')
  assert.equal(provider.companyDomain, 'olxgroup.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-site-handoff-plus-public-lever-job-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page-handoff+public-lever-job-board+public-lever-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /olxgroup[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.olxgroup\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.eu\.lever\.co\/olx/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.eu\.lever\.co\/v0\/postings\/olx\?mode=json/i)
  assert.match(provider.verifiedSurfaceSummary, /\b58\b/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India roles/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Operations Specialist/i)
  assert.match(provider.verifiedSurfaceSummary, /Treasury Manager\/Senior Manager/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OLX Group'), false)

  assert.equal(olxGroup.PROVIDER_METADATA.source, OLX_GROUP_CATALOG.source)
  assert.equal(olxGroup.PROVIDER_METADATA.companyName, OLX_GROUP_CATALOG.companyName)
  assert.equal(olxGroup.PROVIDER_METADATA.leverApiUrl, OLX_GROUP_CATALOG.leverApiUrl)
})

test('OLX Group exact backlog row matches directly from local provider metadata', async () => {
  const { OLX_GROUP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OLX Group\n',
    catalog: [hydrateProviderCatalogEntry(OLX_GROUP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OLX Group', 'olxgroup', 'OLX Group']],
  )
})

test('getScraperCatalog exposes OLX Group as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'olxgroup')
  const scraper = buildScrapers().find((item) => item.name === 'olxgroup')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OLX Group')
  assert.equal(provider.companyCareerPage, 'https://careers.olxgroup.com/jobs/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OLX Group'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OLX Group\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OLX Group', 'olxgroup', 'OLX Group']],
  )
})

test('OLX Group hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { OLX_GROUP_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OLX_GROUP_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'OLX Group')
  assert.equal(provider.companyCareerPage, 'https://careers.olxgroup.com/jobs/')
  assert.equal(provider.companyDomain, 'olxgroup.com')
  assert.equal(provider.atsPlatform, 'lever')
  assert.match(provider.modulePath, /olxgroup[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /olxgroup[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
