import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mapmyindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mapmyindia/catalog.js')
  } catch {
    assert.fail('Expected MapmyIndia catalog module at ../../scraper/mapmyindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/mapmyindia/script.js')
  } catch {
    assert.fail('Expected MapmyIndia scraper module at ../../scraper/mapmyindia/script.js')
  }
}

test('MapmyIndia local catalog captures the verified first-party inline careers surface', async () => {
  const { MAPMYINDIA_CATALOG } = await loadCatalogModule()
  const mapmyindia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MAPMYINDIA_CATALOG)

  assert.equal(provider.source, 'mapmyindia')
  assert.equal(provider.companyName, 'MapmyIndia')
  assert.equal(provider.officialBrandName, 'C.E. Info Systems Ltd. (MapmyIndia)')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mapmyindia.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mapmyindia.com/careers/')
  assert.equal(provider.publicBoardUrl, 'https://www.mapmyindia.com/careers/')
  assert.equal(provider.companyDomain, 'mapmyindia.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-inline-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-inline-job-cards+no-public-per-role-url+page-anchored-listings-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedPublicOpeningCount, 3)
  assert.equal(provider.verifiedApplicationContact, 'hr@mapmyindia.com')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /mapmyindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mapmyindia\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /3 inline public job cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Android Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Inside Sales Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@mapmyindia\.com/i)

  assert.equal(mapmyindia.PROVIDER_METADATA.source, MAPMYINDIA_CATALOG.source)
  assert.equal(mapmyindia.PROVIDER_METADATA.companyName, MAPMYINDIA_CATALOG.companyName)
  assert.equal(mapmyindia.PROVIDER_METADATA.companyCareerPage, MAPMYINDIA_CATALOG.companyCareerPage)
})

test('MapmyIndia exact backlog row resolves directly from local provider metadata', async () => {
  const { MAPMYINDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'MapmyIndia\n',
    catalog: [hydrateProviderCatalogEntry(MAPMYINDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MapmyIndia', 'mapmyindia', 'MapmyIndia']],
  )
})

test('MapmyIndia hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MAPMYINDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAPMYINDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MapmyIndia')
  assert.equal(provider.companyCareerPage, 'https://www.mapmyindia.com/careers/')
  assert.equal(provider.companyDomain, 'mapmyindia.com')
  assert.match(provider.modulePath, /mapmyindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mapmyindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
