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
const modulePath = path.resolve(currentDir, '../../scraper/peakai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/peakai/catalog.js')
  } catch {
    assert.fail('Expected Peak AI catalog module at ../../scraper/peakai/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/peakai/script.js')
  } catch {
    assert.fail('Expected Peak AI scraper module at ../../scraper/peakai/script.js')
  }
}

test('Peak AI local catalog captures the verified official careers home and empty India jobs board contract', async () => {
  const { PEAK_AI_CATALOG } = await loadCatalogModule()
  const peakAi = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PEAK_AI_CATALOG)

  assert.equal(provider.source, 'peakai')
  assert.equal(provider.companyName, 'Peak AI')
  assert.equal(provider.officialBrandName, 'Peak')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://peak.ai/')
  assert.equal(provider.companyCareerPage, 'https://peak.ai/company/careers/india/')
  assert.equal(provider.officialCareersLandingUrl, 'https://peak.ai/company/careers/')
  assert.equal(provider.companyDomain, 'peak.ai')
  assert.equal(provider.atsPlatform, 'official-company-site-empty-jobs-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-home-plus-india-empty-board-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-home+india-opportunities-empty-state-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /peakai[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/peak\.ai\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/peak\.ai\/company\/careers\/india\//i)
  assert.match(provider.verifiedSurfaceSummary, /There are currently no opportunities/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Peak AI'), false)

  assert.equal(peakAi.PROVIDER_METADATA.source, PEAK_AI_CATALOG.source)
  assert.equal(peakAi.PROVIDER_METADATA.companyName, PEAK_AI_CATALOG.companyName)
  assert.equal(
    peakAi.PROVIDER_METADATA.officialCareersLandingUrl,
    PEAK_AI_CATALOG.officialCareersLandingUrl,
  )
})

test('Peak AI exact backlog row resolves directly from local provider metadata', async () => {
  const { PEAK_AI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Peak AI\n',
    catalog: [hydrateProviderCatalogEntry(PEAK_AI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Peak AI', 'peakai', 'Peak AI']],
  )
})

test('getScraperCatalog exposes Peak AI as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'peakai')
  const scraper = buildScrapers().find((item) => item.name === 'peakai')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Peak AI')
  assert.equal(provider.companyCareerPage, 'https://peak.ai/company/careers/india/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Peak AI'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Peak AI\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Peak AI', 'peakai', 'Peak AI']],
  )
})

test('Peak AI hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { PEAK_AI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PEAK_AI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Peak AI')
  assert.equal(provider.companyCareerPage, 'https://peak.ai/company/careers/india/')
  assert.equal(provider.companyDomain, 'peak.ai')
  assert.match(provider.modulePath, /peakai[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /peakai[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
