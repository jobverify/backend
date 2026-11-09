import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kapiva/catalog.js')
  } catch {
    assert.fail('Expected Kapiva catalog module at ../../scraper/kapiva/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kapiva/script.js')
  } catch {
    assert.fail('Expected Kapiva scraper module at ../../scraper/kapiva/script.js')
  }
}

test('Kapiva local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { KAPIVA_CATALOG } = await loadCatalogModule()
  const kapiva = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KAPIVA_CATALOG)

  assert.equal(KAPIVA_CATALOG.source, 'kapiva')
  assert.equal(KAPIVA_CATALOG.companyName, 'Kapiva')
  assert.equal(KAPIVA_CATALOG.officialBrandName, 'Kapiva')
  assert.equal(KAPIVA_CATALOG.adapter, 'script')
  assert.equal(KAPIVA_CATALOG.modulePath, '../../scraper/kapiva/script.js')
  assert.equal(KAPIVA_CATALOG.dryRunFile, 'kapiva/jobs.json')
  assert.equal(KAPIVA_CATALOG.homepageUrl, 'https://kapiva.in/')
  assert.equal(KAPIVA_CATALOG.aboutPageUrl, 'https://kapiva.in/about-us/')
  assert.equal(KAPIVA_CATALOG.contactPageUrl, 'https://kapiva.in/contact-us/')
  assert.equal(KAPIVA_CATALOG.companyCareerPage, 'https://kapiva.in/contact-us/')
  assert.equal(KAPIVA_CATALOG.companyDomain, 'kapiva.in')
  assert.equal(KAPIVA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KAPIVA_CATALOG.countryFilter, 'India')
  assert.equal(
    KAPIVA_CATALOG.paginationStrategy,
    'verified-homepage-plus-about-plus-contact-route-validation',
  )
  assert.equal(
    KAPIVA_CATALOG.extractionStrategy,
    'verified-homepage+verified-about-page+verified-contact-page-without-public-jobs-return-empty',
  )
  assert.equal(KAPIVA_CATALOG.parser, 'custom-script')
  assert.equal(KAPIVA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KAPIVA_CATALOG.verifiedOn, '2026-10-08')
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /Thursday, October 8, 2026/i)
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /https:\/\/kapiva\.in\//i)
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /about-us/i)
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /contact-us/i)
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /careers@kapiva\.in/i)
  assert.match(KAPIVA_CATALOG.verifiedSurfaceSummary, /no trustworthy public job listings/i)

  assert.equal(provider.source, 'kapiva')
  assert.equal(provider.companyName, 'Kapiva')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://kapiva.in/contact-us/')
  assert.equal(provider.companyDomain, 'kapiva.in')
  assert.match(provider.modulePath, /kapiva[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kapiva[\\/]jobs\.json$/i)

  assert.equal(kapiva.PROVIDER_METADATA.source, provider.source)
  assert.equal(kapiva.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(kapiva.ABOUT_PAGE_URL, provider.aboutPageUrl)
  assert.equal(kapiva.CONTACT_PAGE_URL, provider.contactPageUrl)
})

test('Kapiva exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { KAPIVA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Kapiva\n',
    catalog: [hydrateProviderCatalogEntry(KAPIVA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kapiva', 'kapiva', 'Kapiva']],
  )
})
