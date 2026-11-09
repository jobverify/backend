import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mindTickleModulePath = path.resolve(currentDir, '../../scraper/mindtickle/script.js')

const loadMindTickleCatalog = async () => {
  try {
    return await import('../../scraper/mindtickle/catalog.js')
  } catch {
    assert.fail('Expected MindTickle catalog module at ../../scraper/mindtickle/catalog.js')
  }
}

test('MindTickle local catalog captures the verified first-party about page handoff and Lever metadata', async () => {
  const {
    MINDTICKLE_CATALOG,
    default: defaultCatalog,
  } = await loadMindTickleCatalog()
  const provider = hydrateProviderCatalogEntry(MINDTICKLE_CATALOG)

  assert.equal(defaultCatalog, MINDTICKLE_CATALOG)
  assert.equal(provider.source, 'mindtickle')
  assert.equal(provider.companyName, 'MindTickle')
  assert.equal(provider.officialBrandName, 'Mindtickle')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.mindtickle.com/about-us/')
  assert.equal(provider.officialHomepageUrl, 'https://www.mindtickle.com/')
  assert.equal(provider.officialLeverBoardUrl, 'https://jobs.lever.co/mindtickle')
  assert.equal(provider.leverApiUrl, 'https://api.lever.co/v0/postings/mindtickle?mode=json')
  assert.equal(provider.verifiedIndiaCountryCode, 'IN')
  assert.equal(provider.verifiedLeverPostingCount, 21)
  assert.equal(provider.verifiedIndiaRoleCount, 19)
  assert.equal(
    provider.verifiedSampleIndiaJobUrl,
    'https://jobs.lever.co/mindtickle/166a3fea-6a19-48da-9a7d-bbff7d3c2f95',
  )
  assert.equal(provider.atsPlatform, 'lever')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-about-page-plus-lever-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+verified-lever-board+lever-postings-api+india-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mindtickle.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mindtickle[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /mindtickle[\\/]script\.js$/i)
  assert.equal(provider.modulePath, mindTickleModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mindtickle\.com\/about-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.lever\.co\/mindtickle/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/api\.lever\.co\/v0\/postings\/mindtickle\?mode=json/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b21 public postings\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b19 India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Pune, Maharashtra/i)
})

test('MindTickle backlog row matches directly from the local catalog metadata without aliases', async () => {
  const { MINDTICKLE_CATALOG } = await loadMindTickleCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'MindTickle\n',
    catalog: [hydrateProviderCatalogEntry(MINDTICKLE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['MindTickle', 'mindtickle', 'MindTickle']],
  )
})
