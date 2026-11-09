import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadSostronkCatalog = async () => {
  try {
    return await import('../../scraper/sostronk/catalog.js')
  } catch {
    assert.fail('Expected Sostronk catalog module at ../../scraper/sostronk/catalog.js')
  }
}

test('Sostronk catalog metadata captures the verified blocked exact-name routes with branded changelog evidence', async () => {
  const { SOSTRONK_CATALOG } = await loadSostronkCatalog()
  const provider = hydrateProviderCatalogEntry(SOSTRONK_CATALOG)

  assert.equal(provider.source, 'sostronk')
  assert.equal(provider.companyName, 'Sostronk')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.sostronk.com/')
  assert.equal(provider.homepageUrl, 'https://www.sostronk.com/')
  assert.equal(provider.changelogUrl, 'https://changelog.sostronk.com/')
  assert.equal(provider.officialBrandName, 'SoStronk')
  assert.equal(provider.coFounderName, 'Karan')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'exact-name-first-party-route-blocked-surface-validation')
  assert.equal(
    provider.extractionStrategy,
    'search-indexed-first-party-changelog-plus-exact-name-first-party-routes-tls-blocked-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'sostronk.com')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.deepEqual(provider.firstPartyTimeoutUrls, [
    'https://www.sostronk.com/',
    'https://www.sostronk.com/about',
    'https://www.sostronk.com/careers',
    'https://www.sostronk.com/jobs',
    'https://www.sostronk.com/contact',
    'https://changelog.sostronk.com/',
  ])
  assert.match(provider.modulePath, /sostronk[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sostronk[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/changelog\.sostronk\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /SoStronk release notes/i)
  assert.match(provider.verifiedSurfaceSummary, /Karan, Co-Founder & CTO/i)
  assert.match(provider.verifiedSurfaceSummary, /ECONNRESET/i)
  assert.match(provider.verifiedSurfaceSummary, /secure connection is established/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Sostronk exact-name backlog rows resolve from local provider metadata without shared registry edits', async () => {
  const { SOSTRONK_CATALOG } = await loadSostronkCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Sostronk\n',
    catalog: [hydrateProviderCatalogEntry(SOSTRONK_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sostronk', 'sostronk', 'Sostronk']],
  )
})
