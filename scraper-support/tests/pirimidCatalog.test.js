import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const pirimidModulePath = path.resolve(currentDir, '../../scraper/pirimid/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pirimid/catalog.js')
  } catch {
    assert.fail('Expected Pirimid catalog module at ../../scraper/pirimid/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pirimid/script.js')
  } catch {
    assert.fail('Expected Pirimid scraper module at ../../scraper/pirimid/script.js')
  }
}

test('Pirimid local catalog captures the verified first-party inline open positions page and same-page apply anchor', async () => {
  const { PIRIMID_CATALOG } = await loadCatalogModule()
  const pirimid = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PIRIMID_CATALOG)

  assert.equal(provider.source, 'pirimid')
  assert.equal(provider.companyName, 'Pirimid')
  assert.equal(provider.officialBrandName, 'Pirimid Fintech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://pirimidtech.com/careers/')
  assert.equal(provider.companyDomain, 'pirimidtech.com')
  assert.equal(provider.officialCareersEmail, 'careers@pirimidtech.com')
  assert.equal(provider.officialOpenPositionsSectionId, 'openPositions')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedSampleJobTitle, 'Director of Sales')
  assert.equal(provider.verifiedSampleJobLocation, 'Ahmedabad [Hybrid]')
  assert.equal(provider.officialSampleApplyAnchorId, 'apply-form-1')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-inline-open-positions-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+inline-accordion-role-cards+same-page-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, pirimidModulePath)
  assert.match(provider.dryRunFile, /pirimid[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pirimidtech\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Director of Sales/i)
  assert.match(provider.verifiedSurfaceSummary, /Ahmedabad \[Hybrid\]/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@pirimidtech\.com/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pirimid'), false)

  assert.equal(pirimid.PROVIDER_METADATA.source, PIRIMID_CATALOG.source)
  assert.equal(pirimid.PROVIDER_METADATA.companyName, PIRIMID_CATALOG.companyName)
  assert.equal(
    pirimid.PROVIDER_METADATA.officialCareersEmail,
    PIRIMID_CATALOG.officialCareersEmail,
  )
})

test('Pirimid exact backlog row resolves directly from local provider metadata', async () => {
  const { PIRIMID_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pirimid\n',
    catalog: [hydrateProviderCatalogEntry(PIRIMID_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pirimid', 'pirimid', 'Pirimid']],
  )
})

test('getScraperCatalog exposes Pirimid as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pirimid')
  const scraper = buildScrapers().find((item) => item.name === 'pirimid')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pirimid')
  assert.equal(provider.companyCareerPage, 'https://pirimidtech.com/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pirimid'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pirimid\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pirimid', 'pirimid', 'Pirimid']],
  )
})

test('Pirimid hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PIRIMID_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PIRIMID_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /pirimid[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pirimid[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
