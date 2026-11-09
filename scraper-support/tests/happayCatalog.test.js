import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/happay/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/happay/catalog.js')
  } catch {
    assert.fail('Expected Happay catalog module at ../../scraper/happay/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/happay/script.js')
  } catch {
    assert.fail('Expected Happay scraper module at ../../scraper/happay/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Happay local catalog captures the verified first-party careers pages and unresolved jobs shortcode surface', async () => {
  const { HAPPAY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const happay = await loadScriptModule()
  const provider = buildCatalogReadyProvider(HAPPAY_CATALOG)

  assert.equal(defaultCatalog, HAPPAY_CATALOG)
  assert.equal(provider.source, 'happay')
  assert.equal(provider.companyName, 'Happay')
  assert.equal(provider.officialBrandName, 'Happay')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://happay.com/')
  assert.equal(provider.companyCareerPage, 'https://happay.com/careers/')
  assert.equal(provider.jobsPageUrl, 'https://happay.com/jobs/')
  assert.equal(provider.contactPageUrl, 'https://happay.com/contact-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved-listing-contract')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-pages-without-public-job-listings',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-jobs-shortcode-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'happay.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/happay\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/happay\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /\[jobs per_page/i)
  assert.match(provider.verifiedSurfaceSummary, /Makemytrip/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /happay[\\/]jobs\.json$/i)

  assert.equal(happay.PROVIDER_METADATA.source, provider.source)
  assert.equal(happay.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(happay.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Happay exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { HAPPAY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Happay\n',
    catalog: [buildCatalogReadyProvider(HAPPAY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Happay', 'happay', 'Happay']],
  )
})
