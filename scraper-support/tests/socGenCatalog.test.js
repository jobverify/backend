import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/socgen/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/socgen/catalog.js')
  } catch {
    assert.fail('Expected SocGen catalog module at ../../scraper/socgen/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/socgen/script.js')
  } catch {
    assert.fail('Expected SocGen scraper module at ../../scraper/socgen/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('SocGen local catalog captures the verified Societe Generale public careers surface for India jobs', async () => {
  const { SOCGEN_CATALOG } = await loadCatalogModule()
  const socgen = await loadScraperModule()
  const provider = buildCatalogReadyProvider(SOCGEN_CATALOG)

  assert.equal(provider.source, 'socgen')
  assert.equal(provider.companyName, 'SocGen')
  assert.equal(provider.officialBrandName, 'Societe Generale')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.societegenerale.com/en/Technical/all-job-offers')
  assert.equal(provider.companyDomain, 'careers.societegenerale.com')
  assert.equal(provider.atsPlatform, 'oracle-taleo')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedLiveOfferCount, 702)
  assert.equal(provider.verifiedIndiaSampleTitle, 'Senior Analyst')
  assert.equal(provider.paginationStrategy, 'single-public-listing-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-socgen-careers-page+official-careers-listing+detail-pages+taleo-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.societegenerale\.com\/en\/Technical\/all-job-offers/i)
  assert.match(provider.verifiedSurfaceSummary, /702 offre\(s\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Bangalore, India/i)
  assert.match(provider.verifiedSurfaceSummary, /Delivery Manager/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /socgen[\\/]jobs\.json$/i)

  assert.equal(socgen.PROVIDER_METADATA.source, provider.source)
  assert.equal(socgen.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(socgen.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('SocGen exact backlog row matches from the local provider contract without aliases', async () => {
  const { SOCGEN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SocGen\n',
    catalog: [buildCatalogReadyProvider(SOCGEN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SocGen', 'socgen', 'SocGen']],
  )
})
