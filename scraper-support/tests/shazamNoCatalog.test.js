import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/shazamno/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shazamno/catalog.js')
  } catch {
    assert.fail('Expected Shazam? no catalog module at ../../scraper/shazamno/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shazamno/script.js')
  } catch {
    assert.fail('Expected Shazam? no scraper module at ../../scraper/shazamno/script.js')
  }
}

test('Shazam? no local catalog records the row as a verified noisy backlog note without alias churn', async () => {
  const { SHAZAM_NO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shazamNo = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHAZAM_NO_CATALOG)

  assert.equal(defaultCatalog, SHAZAM_NO_CATALOG)
  assert.equal(provider.source, 'shazamno')
  assert.equal(provider.companyName, 'Shazam? no')
  assert.equal(provider.officialBrandName, 'Shazam')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.shazam.com/en-us')
  assert.equal(provider.companyCareerPage, 'https://www.shazam.com/en-us')
  assert.equal(provider.appleCareersSearchUrl, 'https://jobs.apple.com/en-us/search?sort=relevance&search=shazam')
  assert.equal(provider.exactRowClassification, 'noisy-backlog-row')
  assert.equal(provider.companyDomain, 'shazam.com')
  assert.equal(provider.atsPlatform, 'noisy-backlog-row-not-a-real-exact-name-company')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-brand-page-plus-apple-careers-handoff-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-shazam-brand-page+verified-apple-careers-surface+exact-row-not-a-company-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-26')
  assert.match(provider.dryRunFile, /shazamno[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 26, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.shazam\.com\/en-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.apple\.com\/en-us\/search\?sort=relevance&search=shazam/i)
  assert.match(provider.verifiedSurfaceSummary, /Apple Inc\. and its affiliates/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Lead - Shazam/i)
  assert.match(provider.verifiedSurfaceSummary, /noisy note/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shazam? no'), false)

  assert.equal(shazamNo.PROVIDER_METADATA.source, SHAZAM_NO_CATALOG.source)
  assert.equal(shazamNo.PROVIDER_METADATA.companyName, SHAZAM_NO_CATALOG.companyName)
  assert.equal(
    shazamNo.PROVIDER_METADATA.appleCareersSearchUrl,
    SHAZAM_NO_CATALOG.appleCareersSearchUrl,
  )
})

test('Shazam? no exact backlog row matches directly from local provider metadata', async () => {
  const { SHAZAM_NO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shazam? no\n',
    catalog: [hydrateProviderCatalogEntry(SHAZAM_NO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shazam? no', 'shazamno', 'Shazam? no']],
  )
})

test('Shazam? no hydrated local catalog stays script-runner compatible for later registry decisions', async () => {
  const { SHAZAM_NO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SHAZAM_NO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Shazam? no')
  assert.equal(provider.companyCareerPage, 'https://www.shazam.com/en-us')
  assert.equal(provider.companyDomain, 'shazam.com')
  assert.equal(provider.exactRowClassification, 'noisy-backlog-row')
  assert.match(provider.modulePath, /shazamno[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /shazamno[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
