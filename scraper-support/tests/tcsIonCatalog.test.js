import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tcsion/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tcsion/catalog.js')
  } catch {
    assert.fail('Expected TCS iON catalog module at ../../scraper/tcsion/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/tcsion/script.js')
  } catch {
    assert.fail('Expected TCS iON scraper module at ../../scraper/tcsion/script.js')
  }
}

test('TCS iON local catalog captures the verified first-party marketplace without an exact-name employer feed', async () => {
  const { TCS_ION_CATALOG } = await loadCatalogModule()
  const tcsIon = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TCS_ION_CATALOG)

  assert.equal(TCS_ION_CATALOG.source, 'tcsion')
  assert.equal(TCS_ION_CATALOG.companyName, 'TCS iON')
  assert.equal(TCS_ION_CATALOG.officialBrandName, 'TCS iON')
  assert.equal(TCS_ION_CATALOG.adapter, 'script')
  assert.equal(TCS_ION_CATALOG.modulePath, modulePath)
  assert.equal(TCS_ION_CATALOG.dryRunFile, 'tcsion/jobs.json')
  assert.equal(TCS_ION_CATALOG.officialHomepageUrl, 'https://www.tcsion.com/')
  assert.equal(TCS_ION_CATALOG.companyCareerPage, 'https://www.tcsion.com/jobs/')
  assert.equal(
    TCS_ION_CATALOG.sampleMarketplaceListingUrl,
    'https://www.tcsion.com/job-openings/jobs-in-hyderabad',
  )
  assert.equal(TCS_ION_CATALOG.companyDomain, 'tcsion.com')
  assert.equal(TCS_ION_CATALOG.atsPlatform, 'first-party-jobs-marketplace-no-exact-name-employer-surface')
  assert.equal(TCS_ION_CATALOG.countryFilter, 'India')
  assert.equal(
    TCS_ION_CATALOG.paginationStrategy,
    'verified-jobs-marketplace-home-without-exact-name-tcsion-listings',
  )
  assert.equal(
    TCS_ION_CATALOG.extractionStrategy,
    'verified-first-party-marketplace+generic-multi-company-hiring-surface-without-exact-name-tcsion-jobs-return-empty',
  )
  assert.equal(TCS_ION_CATALOG.parser, 'custom-script')
  assert.equal(TCS_ION_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(TCS_ION_CATALOG.verifiedOn, '2026-08-14')
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.tcsion\.com\/jobs\//i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.tcsion\.com\/job-openings\/jobs-in-hyderabad/i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /Unlock Career Opportunities with AI Precision Matching/i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /VISYS CLOUD TECHNOLOGIES INDIA PRIVATE LIMITED/i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /leading companies/i)
  assert.match(TCS_ION_CATALOG.verifiedSurfaceSummary, /no trustworthy exact-name TCS iON employer jobs surface/i)

  assert.equal(provider.source, 'tcsion')
  assert.equal(provider.companyName, 'TCS iON')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tcsion.com/jobs/')
  assert.equal(provider.companyDomain, 'tcsion.com')
  assert.match(provider.modulePath, /tcsion[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tcsion[\\/]jobs\.json$/i)

  assert.equal(tcsIon.PROVIDER_METADATA.source, provider.source)
  assert.equal(tcsIon.CAREERS_URL, provider.companyCareerPage)
})

test('TCS iON exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { TCS_ION_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'TCS iON\n',
    catalog: [hydrateProviderCatalogEntry(TCS_ION_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TCS iON', 'tcsion', 'TCS iON']],
  )
})
