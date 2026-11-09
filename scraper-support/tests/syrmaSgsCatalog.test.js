import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadSyrmaSgsCatalog = async () => {
  try {
    return await import('../../scraper/syrmasgs/catalog.js')
  } catch {
    assert.fail('Expected Syrma SGS catalog module at ../../scraper/syrmasgs/catalog.js')
  }
}

test('Syrma SGS historical July catalog retains its captured archive metadata', async () => {
  const { SYRMA_SGS_CATALOG } = await loadSyrmaSgsCatalog()
  const provider = hydrateProviderCatalogEntry(SYRMA_SGS_CATALOG)

  assert.equal(provider.source, 'syrmasgs')
  assert.equal(provider.companyName, 'Syrma SGS')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://syrmasgs.com/job-openings/')
  assert.equal(provider.officialCareersPageUrl, 'https://syrmasgs.com/job-openings/')
  assert.equal(provider.lifeAtUrl, 'https://syrmasgs.com/life-at-syrmasgs/')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://syrmasgs.com/jobs/manager-sr-manager-npi-engineering/',
  )
  assert.equal(provider.verifiedSampleSecondaryJobUrl, 'https://syrmasgs.com/jobs/22188/')
  assert.equal(provider.officialBrandName, 'Syrma SGS')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-verified-jobs-archive-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-life-page+verified-jobs-archive+verified-detail-pages+inline-apply-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'syrmasgs.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.modulePath, /syrmasgs[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /syrmasgs[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/syrmasgs\.com\/life-at-syrmasgs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/syrmasgs\.com\/job-openings\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/syrmasgs\.com\/jobs\/manager-sr-manager-npi-engineering\//i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Apply for this position/i)
})

test('Syrma SGS current routing preserves exact-name backlog coverage without static inventory authority', () => {
  const provider = getScraperCatalog().find(item => item.source === 'syrmasgs')
  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /syrmasgs[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://syrmasgs.com/job-listing/')
  assert.equal(provider.officialCareersPageUrl, 'https://syrmasgs.com/job-listing/')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  for (const key of ['verifiedOn', 'verifiedAt', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'companyGlobalTotal', 'companyIndiaTotal']) assert.equal(provider[key], null)
  const report = generateCompanyCoverageReport({
    csvText: 'Syrma SGS\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Syrma SGS', 'syrmasgs', 'Syrma SGS']],
  )
})
