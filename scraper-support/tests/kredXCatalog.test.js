import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kredx/catalog.js')
  } catch {
    assert.fail('Expected KredX catalog module at ../../scraper/kredx/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/kredx/script.js')
  } catch {
    assert.fail('Expected KredX scraper module at ../../scraper/kredx/script.js')
  }
}

test('KredX local catalog captures the verified first-party careers page and SmartRecruiters feed', async () => {
  const { KREDX_CATALOG } = await loadCatalogModule()
  const kredx = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(KREDX_CATALOG)

  assert.equal(provider.source, 'kredx')
  assert.equal(provider.companyName, 'KredX')
  assert.equal(provider.officialBrandName, 'KredX')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kredx.com/join-our-team')
  assert.equal(provider.smartRecruitersBoardUrl, 'https://careers.smartrecruiters.com/Kredx')
  assert.equal(
    provider.smartRecruitersListingApiUrl,
    'https://api.smartrecruiters.com/v1/companies/Kredx/postings',
  )
  assert.equal(provider.smartRecruitersCompanyIdentifier, 'Kredx')
  assert.equal(provider.companyDomain, 'kredx.com')
  assert.equal(provider.atsPlatform, 'smartrecruiters')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 8)
  assert.equal(provider.verifiedSampleJobTitle, 'Product Manager')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-public-smartrecruiters-listing-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-openings-page+smartrecruiters-board+listing-api+detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kredx\.com\/join-our-team/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.smartrecruiters\.com\/Kredx/i)
  assert.match(provider.verifiedSurfaceSummary, /8 public jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Product Manager/i)
  assert.match(provider.modulePath, /kredx[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kredx[\\/]jobs\.json$/i)

  assert.equal(kredx.PROVIDER_METADATA.source, provider.source)
  assert.equal(kredx.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(kredx.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(kredx.PROVIDER_METADATA.smartRecruitersBoardUrl, provider.smartRecruitersBoardUrl)
})

test('KredX exact backlog row matches from the local provider contract without aliases', async () => {
  const { KREDX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KredX\n',
    catalog: [hydrateProviderCatalogEntry(KREDX_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KredX', 'kredx', 'KredX']],
  )
})
