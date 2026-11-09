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
const plivoModulePath = path.resolve(currentDir, '../../scraper/plivo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/plivo/catalog.js')
  } catch {
    assert.fail('Expected Plivo catalog module at ../../scraper/plivo/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/plivo/script.js')
  } catch {
    assert.fail('Expected Plivo scraper module at ../../scraper/plivo/script.js')
  }
}

test('Plivo local catalog captures the verified first-party jobs shell and live empty Lever contract', async () => {
  const { PLIVO_CATALOG } = await loadCatalogModule()
  const plivo = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PLIVO_CATALOG)

  assert.equal(provider.source, 'plivo')
  assert.equal(provider.companyName, 'Plivo')
  assert.equal(provider.officialBrandName, 'Plivo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.plivo.com/')
  assert.equal(provider.companyCareerPage, 'https://www.plivo.com/jobs/')
  assert.equal(provider.companyDomain, 'plivo.com')
  assert.equal(provider.officialLeverBoardUrl, 'https://jobs.lever.co/plivo')
  assert.equal(provider.leverApiUrl, 'https://api.lever.co/v0/postings/plivo?mode=json')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'official-jobs-shell-validation-plus-lever-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+verified-jobs-bundle-lever-fetch+empty-lever-api+allow-missing-lever-board',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.modulePath, plivoModulePath)
  assert.match(provider.dryRunFile, /plivo[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.plivo\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/plivo/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.lever\.co\/v0\/postings\/plivo\?mode=json/i)
  assert.match(provider.verifiedSurfaceSummary, /JobsPage\.DH20V3RG\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /404 error/i)
  assert.match(provider.verifiedSurfaceSummary, /03 open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /0 public postings|returned \[\]/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Plivo'), false)

  assert.equal(plivo.PROVIDER_METADATA.source, PLIVO_CATALOG.source)
  assert.equal(plivo.PROVIDER_METADATA.companyName, PLIVO_CATALOG.companyName)
  assert.equal(plivo.PROVIDER_METADATA.leverApiUrl, PLIVO_CATALOG.leverApiUrl)
})

test('Plivo exact backlog row resolves directly from local provider metadata', async () => {
  const { PLIVO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Plivo\n',
    catalog: [hydrateProviderCatalogEntry(PLIVO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Plivo', 'plivo', 'Plivo']],
  )
})

test('getScraperCatalog exposes Plivo as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'plivo')
  const scraper = buildScrapers().find((item) => item.name === 'plivo')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Plivo')
  assert.equal(provider.companyCareerPage, 'https://www.plivo.com/jobs/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Plivo'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Plivo\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Plivo', 'plivo', 'Plivo']],
  )
})

test('Plivo hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { PLIVO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(PLIVO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /plivo[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /plivo[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
