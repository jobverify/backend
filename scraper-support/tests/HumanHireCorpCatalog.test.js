import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/humanhirecorp/catalog.js')
  } catch {
    assert.fail('Expected HumanHire Corp catalog module at ../../scraper/humanhirecorp/catalog.js')
  }
}

test('HumanHire Corp catalog captures the verified recruitment-site SPA shell contract', async () => {
  const { HUMANHIRECORP_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HUMANHIRECORP_CATALOG)

  assert.equal(defaultCatalog, HUMANHIRECORP_CATALOG)
  assert.equal(provider.source, 'humanhirecorp')
  assert.equal(provider.companyName, 'HumanHire Corp')
  assert.equal(provider.officialBrandName, 'HumanHire Corp')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://humanhirecorp.com/')
  assert.equal(provider.companyCareerPage, 'https://humanhirecorp.com/life-at-humanhire')
  assert.equal(provider.atsPlatform, 'first-party-spa-recruitment-site-no-exact-name-employer-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'spa-shell-validation-across-brand-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-recruitment-site-spa-shell-without-ssr-employer-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'humanhirecorp.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.modulePath, /humanhirecorp[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /humanhirecorp[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Global Recruitment & Staffing Solutions/i)
  assert.match(provider.verifiedSurfaceSummary, /div id="root"/i)
})

test('HumanHire Corp exact backlog row resolves from the local catalog contract', async () => {
  const { HUMANHIRECORP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'HumanHire Corp.\n',
    catalog: [hydrateProviderCatalogEntry(HUMANHIRECORP_CATALOG)],
    aliasMap: {
      'HumanHire Corp.': 'humanhirecorp',
    },
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HumanHire Corp.', 'humanhirecorp', 'HumanHire Corp']],
  )
})
