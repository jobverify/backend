import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const m2pFintechModulePath = path.resolve(currentDir, '../../scraper/m2pfintech/script.js')

const loadM2PFintechCatalog = async () => {
  try {
    return await import('../../scraper/m2pfintech/catalog.js')
  } catch {
    assert.fail('Expected M2P Fintech catalog module at ../../scraper/m2pfintech/catalog.js')
  }
}

test('M2P Fintech local catalog captures the verified zero-openings first-party careers surface without alias churn', async () => {
  const {
    M2P_FINTECH_CATALOG,
    default: defaultCatalog,
  } = await loadM2PFintechCatalog()
  const provider = hydrateProviderCatalogEntry(M2P_FINTECH_CATALOG)

  assert.equal(defaultCatalog, M2P_FINTECH_CATALOG)
  assert.equal(provider.source, 'm2pfintech')
  assert.equal(provider.companyName, 'M2P Fintech')
  assert.equal(provider.officialBrandName, 'M2P Fintech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.m2pfintech.com/view-jobs/')
  assert.equal(provider.careersHomeUrl, 'https://careers.m2pfintech.com/')
  assert.equal(provider.officialBrandSiteUrl, 'https://m2pfintech.com/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-single-first-party-jobs-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-homepage+verified-zero-openings-jobs-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'm2pfintech.com')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.verifiedPublicPostingCount, 0)
  assert.match(provider.dryRunFile, /m2pfintech[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /m2pfintech[\\/]script\.js$/i)
  assert.equal(provider.modulePath, m2pFintechModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.m2pfintech\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.m2pfintech\.com\/view-jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /Our Job Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /No Jobs Found/i)
  assert.match(provider.verifiedSurfaceSummary, /Keep exploring this space\./i)
})

test('M2P Fintech backlog row matches directly from the local catalog metadata without aliases', async () => {
  const { M2P_FINTECH_CATALOG } = await loadM2PFintechCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'M2P Fintech\n',
    catalog: [hydrateProviderCatalogEntry(M2P_FINTECH_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['M2P Fintech', 'm2pfintech', 'M2P Fintech']],
  )
})
