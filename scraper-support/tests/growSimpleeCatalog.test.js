import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/growsimplee/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/growsimplee/catalog.js')
  } catch {
    assert.fail('Expected GrowSimplee catalog module at ../../scraper/growsimplee/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/growsimplee/script.js')
  } catch {
    assert.fail('Expected GrowSimplee scraper module at ../../scraper/growsimplee/script.js')
  }
}

test('GrowSimplee local catalog captures the verified first-party docs surface and unavailable main-site routes without alias churn', async () => {
  const { GROW_SIMPLEE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const growSimplee = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(GROW_SIMPLEE_CATALOG)

  assert.equal(defaultCatalog, GROW_SIMPLEE_CATALOG)
  assert.equal(provider.source, 'growsimplee')
  assert.equal(provider.companyName, 'GrowSimplee')
  assert.equal(provider.officialBrandName, 'GrowSimplee')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://growsimplee.com/')
  assert.equal(provider.companyCareerPage, 'https://growsimplee.com/careers')
  assert.equal(provider.trustedApiDocsUrl, 'https://api-docs.growsimplee.com/')
  assert.equal(provider.technicalContactEmail, 'tech@growsimplee.com')
  assert.deepEqual(provider.firstPartyRouteExpectations, [
    { url: 'https://growsimplee.com/', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/', errorKind: 'tls' },
    { url: 'https://growsimplee.com/careers', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/careers', errorKind: 'tls' },
    { url: 'https://growsimplee.com/jobs', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/jobs', errorKind: 'tls' },
    { url: 'https://growsimplee.com/about', errorKind: 'timeout' },
    { url: 'https://www.growsimplee.com/about', errorKind: 'tls' },
  ])
  assert.equal(provider.companyDomain, 'growsimplee.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-api-docs-plus-first-party-route-unavailability-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-api-docs+exact-name-routes-timeout-or-tls-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /growsimplee[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api-docs\.growsimplee\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /tech@growsimplee\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/growsimplee\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /\bTLS\b/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'GrowSimplee'), false)

  assert.equal(growSimplee.PROVIDER_METADATA.source, GROW_SIMPLEE_CATALOG.source)
  assert.equal(growSimplee.PROVIDER_METADATA.companyName, GROW_SIMPLEE_CATALOG.companyName)
  assert.equal(
    growSimplee.PROVIDER_METADATA.trustedApiDocsUrl,
    GROW_SIMPLEE_CATALOG.trustedApiDocsUrl,
  )
})

test('GrowSimplee exact backlog row matches directly from local provider metadata', async () => {
  const { GROW_SIMPLEE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GrowSimplee\n',
    catalog: [hydrateProviderCatalogEntry(GROW_SIMPLEE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GrowSimplee', 'growsimplee', 'GrowSimplee']],
  )
})

test('GrowSimplee hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { GROW_SIMPLEE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GROW_SIMPLEE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GrowSimplee')
  assert.equal(provider.companyCareerPage, 'https://growsimplee.com/careers')
  assert.equal(provider.companyDomain, 'growsimplee.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /growsimplee[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /growsimplee[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
