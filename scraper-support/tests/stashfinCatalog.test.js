import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/stashfin/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/stashfin/catalog.js')
  } catch {
    assert.fail('Expected Stashfin catalog module at ../../scraper/stashfin/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/stashfin/script.js')
  } catch {
    assert.fail('Expected Stashfin scraper module at ../../scraper/stashfin/script.js')
  }
}

test('Stashfin local catalog captures the verified first-party inline careers surface without alias churn', async () => {
  const { STASHFIN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const stashfin = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(STASHFIN_CATALOG)

  assert.equal(defaultCatalog, STASHFIN_CATALOG)
  assert.equal(provider.source, 'stashfin')
  assert.equal(provider.companyName, 'Stashfin')
  assert.equal(provider.officialBrandName, 'Stashfin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.stashfin.com/')
  assert.equal(provider.companyCareerPage, 'https://www.stashfin.com/careers')
  assert.equal(provider.publicBoardUrl, 'https://www.stashfin.com/careers')
  assert.equal(provider.companyDomain, 'stashfin.com')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-inline-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-inline-job-cards+no-public-per-role-url+page-anchored-listings-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.verifiedPublicOpeningCount, 8)
  assert.equal(provider.verifiedPrimaryLocation, 'Gurgaon, India')
  assert.match(provider.dryRunFile, /stashfin[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.stashfin\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /8 inline public job cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Gurgaon, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Frontend Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /no distinct public per-role URLs/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Stashfin'), false)

  assert.equal(stashfin.PROVIDER_METADATA.source, STASHFIN_CATALOG.source)
  assert.equal(stashfin.PROVIDER_METADATA.companyName, STASHFIN_CATALOG.companyName)
  assert.equal(stashfin.PROVIDER_METADATA.publicBoardUrl, STASHFIN_CATALOG.publicBoardUrl)
})

test('Stashfin exact backlog row matches directly from local provider metadata', async () => {
  const { STASHFIN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Stashfin\n',
    catalog: [hydrateProviderCatalogEntry(STASHFIN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Stashfin', 'stashfin', 'Stashfin']],
  )
})

test('Stashfin hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { STASHFIN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(STASHFIN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Stashfin')
  assert.equal(provider.companyCareerPage, 'https://www.stashfin.com/careers')
  assert.equal(provider.companyDomain, 'stashfin.com')
  assert.match(provider.modulePath, /stashfin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /stashfin[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
