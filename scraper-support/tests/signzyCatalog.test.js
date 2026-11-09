import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/signzy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/signzy/catalog.js')
  } catch {
    assert.fail('Expected Signzy catalog module at ../../scraper/signzy/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/signzy/script.js')
  } catch {
    assert.fail('Expected Signzy scraper module at ../../scraper/signzy/script.js')
  }
}

test('Signzy local catalog captures the verified first-party careers page with the broken jobs CTA loopback', async () => {
  const { SIGNZY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const signzy = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SIGNZY_CATALOG)

  assert.equal(defaultCatalog, SIGNZY_CATALOG)
  assert.equal(provider.source, 'signzy')
  assert.equal(provider.companyName, 'Signzy')
  assert.equal(provider.officialBrandName, 'Signzy Technologies Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.signzy.com/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.signzy.com/careers')
  assert.equal(provider.verifiedBrokenJobsCtaUrl, 'https://www.signzy.com/carrers')
  assert.equal(provider.companyDomain, 'signzy.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-broken-jobs-cta')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+broken-first-party-jobs-cta+no-trustworthy-public-job-listings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.dryRunFile, /signzy[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.signzy\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.signzy\.com\/carrers/i)
  assert.match(provider.verifiedSurfaceSummary, /View All Positions/i)
  assert.match(provider.verifiedSurfaceSummary, /loops back/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Signzy'), false)

  assert.equal(signzy.PROVIDER_METADATA.source, SIGNZY_CATALOG.source)
  assert.equal(signzy.PROVIDER_METADATA.companyName, SIGNZY_CATALOG.companyName)
})

test('Signzy exact backlog row matches directly from local provider metadata', async () => {
  const { SIGNZY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Signzy\n',
    catalog: [hydrateProviderCatalogEntry(SIGNZY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Signzy', 'signzy', 'Signzy']],
  )
})

test('Signzy hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SIGNZY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIGNZY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Signzy')
  assert.equal(provider.companyCareerPage, 'https://www.signzy.com/careers')
  assert.equal(provider.companyDomain, 'signzy.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-broken-jobs-cta')
  assert.match(provider.modulePath, /signzy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /signzy[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
