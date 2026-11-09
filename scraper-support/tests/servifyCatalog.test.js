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
const modulePath = path.resolve(currentDir, '../../scraper/servify/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/servify/catalog.js')
  } catch {
    assert.fail('Expected Servify catalog module at ../../scraper/servify/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/servify/script.js')
  } catch {
    assert.fail('Expected Servify scraper module at ../../scraper/servify/script.js')
  }
}

test('Servify local catalog captures the verified official email-apply careers contract', async () => {
  const { SERVIFY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const servify = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SERVIFY_CATALOG)

  assert.equal(defaultCatalog, SERVIFY_CATALOG)
  assert.equal(provider.source, 'servify')
  assert.equal(provider.companyName, 'Servify')
  assert.equal(provider.officialBrandName, 'Servify')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://servify.com/')
  assert.equal(provider.companyCareerPage, 'https://servify.com/us/careers/')
  assert.equal(provider.officialCareersEmail, 'careers@servify.com')
  assert.equal(provider.companyDomain, 'servify.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-email-apply')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-validation-only')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+email-apply-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /servify[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/servify\.com\/us\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /careers@servify\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Servify'), false)

  assert.equal(servify.PROVIDER_METADATA.source, SERVIFY_CATALOG.source)
  assert.equal(servify.CAREERS_URL, SERVIFY_CATALOG.companyCareerPage)
  assert.equal(servify.CAREERS_EMAIL, SERVIFY_CATALOG.officialCareersEmail)
})

test('Servify exact backlog row resolves directly from local provider metadata', async () => {
  const { SERVIFY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Servify\n',
    catalog: [hydrateProviderCatalogEntry(SERVIFY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Servify', 'servify', 'Servify']],
  )
})

test('getScraperCatalog exposes Servify as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'servify')
  const scraper = buildScrapers().find((item) => item.name === 'servify')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Servify')
  assert.equal(provider.companyCareerPage, 'https://servify.com/us/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Servify'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Servify\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Servify', 'servify', 'Servify']],
  )
})

test('Servify hydrated local catalog stays script-runner compatible for shared registry integration', async () => {
  const { SERVIFY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SERVIFY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Servify')
  assert.equal(provider.companyCareerPage, 'https://servify.com/us/careers/')
  assert.equal(provider.companyDomain, 'servify.com')
  assert.match(provider.modulePath, /servify[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /servify[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
