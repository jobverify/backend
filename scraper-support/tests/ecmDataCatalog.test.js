import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ecmdata/catalog.js')
  } catch {
    assert.fail('Expected ECM Data catalog module at ../../scraper/ecmdata/catalog.js')
  }
}

const loadEcmDataModule = async () => {
  try {
    return await import('../../scraper/ecmdata/script.js')
  } catch {
    assert.fail('Expected ECM Data scraper module at ../../scraper/ecmdata/script.js')
  }
}

test('ECM Data local catalog captures the verified unavailable first-party surface without aliases', async () => {
  const { ECM_DATA_CATALOG } = await loadCatalogModule()
  const ecmData = await loadEcmDataModule()
  const provider = hydrateProviderCatalogEntry(ECM_DATA_CATALOG)

  assert.equal(provider.source, 'ecmdata')
  assert.equal(provider.companyName, 'ECM Data')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /ecmdata[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://ecmdata.com/')
  assert.equal(provider.companyDomain, 'ecmdata.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'exact-name-domain-cloudflare-522-plus-unresolved-india-variant-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-domain-routes-return-cloudflare-522-plus-unresolved-india-variant-hosts-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ecmdata\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ecmdata\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ecmdata\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/ecmdata\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 522/i)
  assert.match(provider.verifiedSurfaceSummary, /did not resolve/i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy public first-party jobs surface was reachable/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'ECM Data'), false)

  assert.equal(ecmData.PROVIDER_METADATA.source, ECM_DATA_CATALOG.source)
  assert.equal(ecmData.PROVIDER_METADATA.companyName, ECM_DATA_CATALOG.companyName)
  assert.equal(ecmData.PROVIDER_METADATA.companyCareerPage, ECM_DATA_CATALOG.companyCareerPage)
})

test('ECM Data backlog row matches directly from local provider metadata without alias churn', async () => {
  const { ECM_DATA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ECM Data\n',
    catalog: [hydrateProviderCatalogEntry(ECM_DATA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ECM Data', 'ecmdata', 'ECM Data']],
  )
})
