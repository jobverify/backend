import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tbotek/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tbotek/catalog.js')
  } catch {
    assert.fail('Expected TBO Tek catalog module at ../../scraper/tbotek/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tbotek/script.js')
  } catch {
    assert.fail('Expected TBO Tek scraper module at ../../scraper/tbotek/script.js')
  }
}

test('TBO Tek local catalog captures the verified first-party careers handoff and exact-name legal evidence without alias churn', async () => {
  const { TBOTEK_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tboTek = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TBOTEK_CATALOG)

  assert.equal(defaultCatalog, TBOTEK_CATALOG)
  assert.equal(provider.source, 'tbotek')
  assert.equal(provider.companyName, 'TBO Tek')
  assert.equal(provider.officialBrandName, 'TBO.COM')
  assert.equal(provider.companyLegalName, 'TBO Tek Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tbo.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.tbo.com/careers')
  assert.equal(provider.exactNameEvidenceUrl, 'https://www.tbo.com/terms-and-conditions')
  assert.equal(provider.officialCareersHandoffUrl, 'https://tbo.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://tbo.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.companyDomain, 'tbo.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+official-darwinbox-handoff+exact-name-legal-page+darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /tbotek[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tbo\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tbo\.com\/terms-and-conditions/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tbo\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /TBO Tek Ltd/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'TBO Tek'), false)

  assert.equal(tboTek.PROVIDER_METADATA.source, TBOTEK_CATALOG.source)
  assert.equal(tboTek.PROVIDER_METADATA.companyName, TBOTEK_CATALOG.companyName)
  assert.equal(tboTek.PROVIDER_METADATA.companyLegalName, TBOTEK_CATALOG.companyLegalName)
})

test('TBO Tek exact backlog row matches directly from local provider metadata', async () => {
  const { TBOTEK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TBO Tek\n',
    catalog: [hydrateProviderCatalogEntry(TBOTEK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TBO Tek', 'tbotek', 'TBO Tek']],
  )
})

test('TBO Tek hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TBOTEK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TBOTEK_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'TBO Tek')
  assert.equal(provider.companyCareerPage, 'https://www.tbo.com/careers')
  assert.equal(provider.companyDomain, 'tbo.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(provider.modulePath, /tbotek[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tbotek[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
