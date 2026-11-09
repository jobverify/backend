import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jupitermoney/catalog.js')
  } catch {
    assert.fail('Expected Jupiter Money catalog module at ../../scraper/jupitermoney/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/jupitermoney/script.js')
  } catch {
    assert.fail('Expected Jupiter Money scraper module at ../../scraper/jupitermoney/script.js')
  }
}

test('Jupiter Money local catalog captures the verified first-party Keka handoff surface', async () => {
  const { JUPITER_MONEY_CATALOG } = await loadCatalogModule()
  const jupiterMoney = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(JUPITER_MONEY_CATALOG)

  assert.equal(JUPITER_MONEY_CATALOG.source, 'jupitermoney')
  assert.equal(JUPITER_MONEY_CATALOG.companyName, 'Jupiter Money')
  assert.equal(JUPITER_MONEY_CATALOG.officialBrandName, 'Jupiter Money')
  assert.equal(JUPITER_MONEY_CATALOG.adapter, 'script')
  assert.equal(JUPITER_MONEY_CATALOG.modulePath, '../../scraper/jupitermoney/script.js')
  assert.equal(JUPITER_MONEY_CATALOG.dryRunFile, 'jupitermoney/jobs.json')
  assert.equal(JUPITER_MONEY_CATALOG.homepageUrl, 'https://jupiter.money/')
  assert.equal(JUPITER_MONEY_CATALOG.aboutPageUrl, 'https://jupiter.money/about-us/')
  assert.equal(JUPITER_MONEY_CATALOG.companyCareerPage, 'https://jupiter.money/contact/')
  assert.equal(JUPITER_MONEY_CATALOG.externalHandoffUrl, 'https://jupiter.keka.com/careers')
  assert.equal(
    JUPITER_MONEY_CATALOG.careerPortalInfoUrl,
    'https://jupiter.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(JUPITER_MONEY_CATALOG.expectedIdentifier, 'b5279857-cf81-4dde-a215-fc48957ee2b5')
  assert.equal(JUPITER_MONEY_CATALOG.expectedKekaDomain, 'https://jupiter.keka.com/careers/')
  assert.equal(JUPITER_MONEY_CATALOG.atsPlatform, 'keka-embed-api')
  assert.equal(JUPITER_MONEY_CATALOG.countryFilter, 'India')
  assert.equal(
    JUPITER_MONEY_CATALOG.paginationStrategy,
    'official-contact-page-handoff-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    JUPITER_MONEY_CATALOG.extractionStrategy,
    'verified-first-party-contact-page+verified-keka-handoff+embedded-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails',
  )
  assert.equal(JUPITER_MONEY_CATALOG.parser, 'custom-script')
  assert.equal(JUPITER_MONEY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JUPITER_MONEY_CATALOG.companyDomain, 'jupiter.money')
  assert.equal(JUPITER_MONEY_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(JUPITER_MONEY_CATALOG.verifiedPublicPostingCount, 13)
  assert.match(JUPITER_MONEY_CATALOG.verifiedSurfaceSummary, /https:\/\/jupiter\.money\/contact\//i)
  assert.match(JUPITER_MONEY_CATALOG.verifiedSurfaceSummary, /https:\/\/jupiter\.keka\.com\/careers/i)
  assert.match(JUPITER_MONEY_CATALOG.verifiedSurfaceSummary, /careerportalinfo/i)
  assert.match(JUPITER_MONEY_CATALOG.verifiedSurfaceSummary, /13 public postings/i)

  assert.equal(provider.source, 'jupitermoney')
  assert.equal(provider.companyName, 'Jupiter Money')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://jupiter.money/contact/')
  assert.equal(provider.companyDomain, 'jupiter.money')
  assert.match(provider.modulePath, /jupitermoney[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /jupitermoney[\\/]jobs\.json$/i)

  assert.equal(jupiterMoney.PROVIDER_METADATA.source, provider.source)
  assert.equal(jupiterMoney.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(jupiterMoney.ABOUT_PAGE_URL, provider.aboutPageUrl)
  assert.equal(jupiterMoney.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(jupiterMoney.EXTERNAL_HANDOFF_URL, provider.externalHandoffUrl)
  assert.equal(jupiterMoney.CAREER_PORTAL_INFO_URL, provider.careerPortalInfoUrl)
})

test('Jupiter Money exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { JUPITER_MONEY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Jupiter Money\n',
    catalog: [hydrateProviderCatalogEntry(JUPITER_MONEY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jupiter Money', 'jupitermoney', 'Jupiter Money']],
  )
})
