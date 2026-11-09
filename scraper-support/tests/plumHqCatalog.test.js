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
const plumHqModulePath = path.resolve(currentDir, '../../scraper/plumhq/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/plumhq/catalog.js')
  } catch {
    assert.fail('Expected Plum HQ catalog module at ../../scraper/plumhq/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/plumhq/script.js')
  } catch {
    assert.fail('Expected Plum HQ scraper module at ../../scraper/plumhq/script.js')
  }
}

test('Plum HQ local catalog captures the verified first-party careers page and embedded Kula board without alias churn', async () => {
  const { PLUM_HQ_CATALOG } = await loadCatalogModule()
  const plumHq = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PLUM_HQ_CATALOG)

  assert.equal(provider.source, 'plumhq')
  assert.equal(provider.companyName, 'Plum HQ')
  assert.equal(provider.officialBrandName, 'Plum')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.plumhq.com/')
  assert.equal(provider.companyCareerPage, 'https://www.plumhq.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.plumhq.com/careers')
  assert.equal(provider.officialJobsBoardUrl, 'https://careers.kula.ai/plumhq?jobs=true')
  assert.equal(provider.officialKulaCompanyUrl, 'https://careers.kula.ai/plumhq')
  assert.equal(provider.atsPlatform, 'kula')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-embedded-kula-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+embedded-kula-board+india-office-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'plumhq.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /plumhq[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, plumHqModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.plumhq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.kula\.ai\/plumhq\?jobs=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead, Account-Based Marketing/i)
  assert.match(provider.verifiedSurfaceSummary, /Mobile Fullstack Developer - II \(iOS\)/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Plum HQ'), false)

  assert.equal(plumHq.PROVIDER_METADATA.source, PLUM_HQ_CATALOG.source)
  assert.equal(plumHq.PROVIDER_METADATA.companyName, PLUM_HQ_CATALOG.companyName)
  assert.equal(
    plumHq.PROVIDER_METADATA.officialJobsBoardUrl,
    PLUM_HQ_CATALOG.officialJobsBoardUrl,
  )
})

test('Plum HQ backlog row matches directly from the local catalog without alias churn', async () => {
  const { PLUM_HQ_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Plum HQ\n',
    catalog: [hydrateProviderCatalogEntry(PLUM_HQ_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Plum HQ', 'plumhq', 'Plum HQ']],
  )
})

test('getScraperCatalog exposes Plum HQ as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'plumhq')
  const scraper = buildScrapers().find((item) => item.name === 'plumhq')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Plum HQ')
  assert.equal(provider.companyCareerPage, 'https://www.plumhq.com/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Plum HQ'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Plum HQ\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Plum HQ', 'plumhq', 'Plum HQ']],
  )
})
