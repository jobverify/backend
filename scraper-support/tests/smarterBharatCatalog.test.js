import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadSmarterBharatCatalog = async () => {
  try {
    return await import('../../scraper/smarterbharat/catalog.js')
  } catch {
    assert.fail('Expected SmarterBharat catalog module at ../../scraper/smarterbharat/catalog.js')
  }
}

test('SmarterBharat catalog metadata captures the unresolved exact-name first-party domain sentinel', async () => {
  const { SMARTER_BHARAT_CATALOG } = await loadSmarterBharatCatalog()
  const provider = hydrateProviderCatalogEntry(SMARTER_BHARAT_CATALOG)

  assert.equal(provider.source, 'smarterbharat')
  assert.equal(provider.companyName, 'SmarterBharat')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://smarterbharat.com/')
  assert.equal(provider.homepageUrl, 'https://smarterbharat.com/')
  assert.equal(provider.officialBrandName, 'SmarterBharat')
  assert.equal(provider.atsPlatform, 'exact-name-domains-unresolvable-or-untrusted')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'candidate-exact-name-domain-resolution-and-trust-validation')
  assert.equal(
    provider.extractionStrategy,
    'exact-name-first-party-domain-candidates-unresolvable-or-untrusted-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'smarterbharat.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.deepEqual(provider.candidateFirstPartyUrls, [
    'https://smarterbharat.com/',
    'https://www.smarterbharat.com/',
    'https://smarterbharat.in/',
    'https://www.smarterbharat.in/',
    'https://smarterbharat.ai/',
    'https://www.smarterbharat.ai/',
    'https://smarterbharat.io/',
    'https://www.smarterbharat.io/',
  ])
  assert.match(provider.modulePath, /smarterbharat[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /smarterbharat[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /SmarterBharat careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/smarterbharat\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.smarterbharat\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /Could not resolve host/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(provider.verifiedSurfaceSummary, /SmartBharat/i)
})

test('SmarterBharat exact-name backlog rows resolve from local provider metadata without shared registry edits', async () => {
  const { SMARTER_BHARAT_CATALOG } = await loadSmarterBharatCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'SmarterBharat\n',
    catalog: [hydrateProviderCatalogEntry(SMARTER_BHARAT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SmarterBharat', 'smarterbharat', 'SmarterBharat']],
  )
})
