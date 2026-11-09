import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/firstcry/catalog.js')
  } catch {
    assert.fail('Expected FirstCry catalog module at ../../scraper/firstcry/catalog.js')
  }
}

const loadFirstCryModule = async () => {
  try {
    return await import('../../scraper/firstcry/script.js')
  } catch {
    assert.fail('Expected FirstCry scraper module at ../../scraper/firstcry/script.js')
  }
}

test('FirstCry local catalog captures the verified first-party informational careers surface without aliases', async () => {
  const { FIRSTCRY_CATALOG } = await loadCatalogModule()
  const firstCry = await loadFirstCryModule()
  const provider = hydrateProviderCatalogEntry(FIRSTCRY_CATALOG)

  assert.equal(provider.source, 'firstcry')
  assert.equal(provider.companyName, 'FirstCry')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /firstcry[\\/]script\.js$/i)
  assert.equal(provider.homepageUrl, 'https://www.firstcry.com/')
  assert.equal(provider.companyCareerPage, 'https://www.firstcry.com/careers')
  assert.equal(provider.companyDomain, 'firstcry.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-footer-link-plus-informational-careers-page-no-public-jobs',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-footer-link+verified-informational-careers-page-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.firstcry\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.firstcry\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings at FirstCry\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /working at firstcry\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'FirstCry'), false)

  assert.equal(firstCry.PROVIDER_METADATA.source, FIRSTCRY_CATALOG.source)
  assert.equal(firstCry.PROVIDER_METADATA.companyName, FIRSTCRY_CATALOG.companyName)
  assert.equal(firstCry.PROVIDER_METADATA.homepageUrl, FIRSTCRY_CATALOG.homepageUrl)
  assert.equal(firstCry.PROVIDER_METADATA.companyCareerPage, FIRSTCRY_CATALOG.companyCareerPage)
})

test('FirstCry backlog row matches directly from local provider metadata without alias churn', async () => {
  const { FIRSTCRY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'FirstCry\n',
    catalog: [hydrateProviderCatalogEntry(FIRSTCRY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FirstCry', 'firstcry', 'FirstCry']],
  )
})
