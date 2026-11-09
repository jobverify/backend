import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const sageIntacctModulePath = path.resolve(currentDir, '../../scraper/sageintacct/script.js')

const loadSageIntacctCatalog = async () => {
  try {
    return await import('../../scraper/sageintacct/catalog.js')
  } catch {
    assert.fail('Expected Sage Intacct catalog module at ../../scraper/sageintacct/catalog.js')
  }
}

test('Sage Intacct local catalog captures the verified shared Sage careers-hub sentinel contract', async () => {
  const {
    SAGE_INTACCT_CATALOG,
    default: defaultCatalog,
  } = await loadSageIntacctCatalog()
  const provider = hydrateProviderCatalogEntry(SAGE_INTACCT_CATALOG)

  assert.equal(defaultCatalog, SAGE_INTACCT_CATALOG)
  assert.equal(provider.source, 'sageintacct')
  assert.equal(provider.companyName, 'Sage Intacct')
  assert.equal(provider.officialBrandName, 'Sage Intacct')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialBrandSiteUrl, 'https://www.sage.com/en-us/sage-business-cloud/intacct/')
  assert.equal(provider.companyCareerPage, 'https://www.sage.com/en-us/company/careers/')
  assert.equal(provider.officialSearchPageUrl, 'https://www.sage.com/en-us/company/careers/career-search/')
  assert.equal(provider.indiaLocationsPageUrl, 'https://www.sage.com/en-us/company/careers/locations/')
  assert.equal(provider.companyDomain, 'sage.com')
  assert.equal(provider.atsPlatform, 'sage-shared-careers-hub-sentinel')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'shared-sage-careers-hub-without-exact-brand-job-surface')
  assert.equal(
    provider.extractionStrategy,
    'verified-sage-intacct-product-page+browser-verified-sage-careers-hub+verified-india-locations-no-exact-brand-job-surface-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sage\.com\/en-us\/sage-business-cloud\/intacct\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sage\.com\/en-us\/company\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sage\.com\/en-us\/company\/careers\/locations\//i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 403/i)
  assert.match(provider.verifiedSurfaceSummary, /blocked by the same Cloudflare 403 interstitial/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy exact-name public jobs surface/i)
  assert.equal(provider.modulePath, sageIntacctModulePath)
  assert.match(provider.dryRunFile, /sageintacct[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sage Intacct'), false)
  assert.equal(companyAliases['Sage Intacct India'], 'sageintacct')
})

test('Sage Intacct exact backlog row matches directly from the local catalog without shared aliases', async () => {
  const { SAGE_INTACCT_CATALOG } = await loadSageIntacctCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Sage Intacct\n',
    catalog: [hydrateProviderCatalogEntry(SAGE_INTACCT_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sage Intacct', 'sageintacct', 'Sage Intacct']],
  )
})

test('Sage Intacct India is covered by the same provider through the shared alias map', async () => {
  const { SAGE_INTACCT_CATALOG } = await loadSageIntacctCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Sage Intacct\nSage Intacct India\n',
    catalog: [hydrateProviderCatalogEntry(SAGE_INTACCT_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Sage Intacct', 'sageintacct', 'Sage Intacct'],
      ['Sage Intacct India', 'sageintacct', 'Sage Intacct'],
    ],
  )
})
