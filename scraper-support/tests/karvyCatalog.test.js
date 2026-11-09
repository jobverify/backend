import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/karvy/catalog.js')
  } catch {
    assert.fail('Expected Karvy catalog module at ../../scraper/karvy/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/karvy/script.js')
  } catch {
    assert.fail('Expected Karvy scraper module at ../../scraper/karvy/script.js')
  }
}

test('Karvy local catalog captures the verified no-trustworthy-public-jobs sentinel state', async () => {
  const { KARVY_CATALOG } = await loadCatalogModule()
  const karvy = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KARVY_CATALOG)

  assert.equal(provider.source, 'karvy')
  assert.equal(provider.companyName, 'Karvy')
  assert.equal(provider.officialBrandName, 'Karvy')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /karvy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /karvy[\\/]jobs\.json$/i)
  assert.equal(provider.homepageUrl, 'https://www.karvy.com/')
  assert.deepEqual(provider.parkedHomepageUrls, [
    'https://karvy.com/',
    'https://www.karvy.com/',
  ])
  assert.equal(provider.legacyHomepageUrl, 'https://www.karvyonline.com/')
  assert.equal(provider.companyCareerPage, 'https://www.karvyonline.com/join-us/career/')
  assert.equal(provider.companyDomain, 'karvy.com')
  assert.equal(provider.legacyCompanyDomain, 'karvyonline.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'inactive-exact-domain-plus-first-party-legacy-root-handoff-plus-stale-resume-page-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-domain-not-jobs+verified-legacy-redirect-shell-and-parked-lander+legacy-first-party-root-and-stale-resume-page-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.karvy\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Porkbun/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.karvyonline\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /\/lander/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.karvyonline\.com\/join-us\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /redirect/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(karvy.PROVIDER_METADATA.source, provider.source)
  assert.equal(karvy.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(karvy.CAREERS_URL, provider.companyCareerPage)
})

test('Karvy exact-name backlog row resolves directly from the local sentinel provider without aliases', async () => {
  const { KARVY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Karvy\n',
    catalog: [hydrateProviderCatalogEntry(KARVY_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Karvy', 'karvy', 'Karvy']],
  )
})
