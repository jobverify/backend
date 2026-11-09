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
const modulePath = path.resolve(currentDir, '../../scraper/pixxel/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pixxel/catalog.js')
  } catch {
    assert.fail('Expected Pixxel catalog module at ../../scraper/pixxel/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/pixxel/script.js')
  } catch {
    assert.fail('Expected Pixxel scraper module at ../../scraper/pixxel/script.js')
  }
}

test('Pixxel local catalog captures the verified official careers page and Darwinbox handoff', async () => {
  const { PIXXEL_CATALOG } = await loadCatalogModule()
  const pixxel = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PIXXEL_CATALOG)

  assert.equal(provider.source, 'pixxel')
  assert.equal(provider.companyName, 'Pixxel')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.pixxel.space/careers')
  assert.equal(provider.companyDomain, 'pixxel.space')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-page+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.officialCareersHandoffUrl, 'https://pixxel.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.darwinboxOrigin, 'https://pixxel.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /pixxel[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.pixxel\.space\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/pixxel\.darwinbox\.in\/ms\/candidate\/careers/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Calibration Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Role Explorer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pixxel'), false)

  assert.equal(pixxel.PROVIDER_METADATA.source, PIXXEL_CATALOG.source)
  assert.equal(pixxel.PROVIDER_METADATA.companyName, PIXXEL_CATALOG.companyName)
  assert.equal(
    pixxel.PROVIDER_METADATA.officialCareersHandoffUrl,
    PIXXEL_CATALOG.officialCareersHandoffUrl,
  )
})

test('Pixxel exact backlog row resolves directly from local provider metadata', async () => {
  const { PIXXEL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pixxel\n',
    catalog: [hydrateProviderCatalogEntry(PIXXEL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pixxel', 'pixxel', 'Pixxel']],
  )
})

test('getScraperCatalog exposes Pixxel as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pixxel')
  const scraper = buildScrapers().find((item) => item.name === 'pixxel')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pixxel')
  assert.equal(provider.companyCareerPage, 'https://www.pixxel.space/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pixxel'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pixxel\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pixxel', 'pixxel', 'Pixxel']],
  )
})

test('Pixxel hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { PIXXEL_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PIXXEL_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /pixxel[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pixxel[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
