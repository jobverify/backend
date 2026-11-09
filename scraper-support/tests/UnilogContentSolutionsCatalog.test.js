import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/unilogcontentsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/unilogcontentsolutions/catalog.js')
  } catch {
    assert.fail('Expected Unilog Content Solutions catalog module at ../../scraper/unilogcontentsolutions/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/unilogcontentsolutions/script.js')
  } catch {
    assert.fail('Expected Unilog Content Solutions scraper module at ../../scraper/unilogcontentsolutions/script.js')
  }
}

test('Unilog Content Solutions local catalog captures the verified Cloudflare-challenged first-party contract', async () => {
  const { UNILOG_CONTENT_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const unilog = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(UNILOG_CONTENT_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, UNILOG_CONTENT_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'unilogcontentsolutions')
  assert.equal(provider.companyName, 'Unilog Content Solutions ( P)')
  assert.equal(provider.officialBrandName, 'Unilog')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.unilogcorp.com/')
  assert.equal(provider.companyCareerPage, 'https://www.unilogcorp.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.unilogcorp.com/careers/')
  assert.equal(provider.companyDomain, 'unilogcorp.com')
  assert.equal(provider.atsPlatform, 'official-company-site-cloudflare-challenge-no-public-jobs-catalog')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-cloudflare-challenged-homepage-and-careers-routes')
  assert.equal(provider.extractionStrategy, 'verified-cloudflare-challenged-homepage+verified-cloudflare-challenged-careers-route-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.match(provider.dryRunFile, /unilogcontentsolutions[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(provider.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.unilogcorp\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.unilogcorp\.com\/careers\//i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Unilog Content Solutions ( P)'), false)

  assert.equal(unilog.PROVIDER_METADATA.source, UNILOG_CONTENT_SOLUTIONS_CATALOG.source)
  assert.equal(unilog.PROVIDER_METADATA.companyName, UNILOG_CONTENT_SOLUTIONS_CATALOG.companyName)
})

test('Unilog Content Solutions exact backlog row matches directly from local provider metadata', async () => {
  const { UNILOG_CONTENT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Unilog Content Solutions ( P)\n',
    catalog: [hydrateProviderCatalogEntry(UNILOG_CONTENT_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Unilog Content Solutions ( P)', 'unilogcontentsolutions', 'Unilog Content Solutions ( P)']],
  )
})

test('Unilog Content Solutions hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { UNILOG_CONTENT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(UNILOG_CONTENT_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Unilog Content Solutions ( P)')
  assert.equal(provider.companyCareerPage, 'https://www.unilogcorp.com/careers/')
  assert.equal(provider.companyDomain, 'unilogcorp.com')
  assert.equal(provider.atsPlatform, 'official-company-site-cloudflare-challenge-no-public-jobs-catalog')
  assert.match(provider.modulePath, /unilogcontentsolutions[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /unilogcontentsolutions[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
