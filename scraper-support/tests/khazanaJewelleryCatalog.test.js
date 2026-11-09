import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/khazanajewellery/catalog.js')
  } catch {
    assert.fail('Expected Khazana Jewellery catalog module at ../../scraper/khazanajewellery/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/khazanajewellery/script.js')
  } catch {
    assert.fail('Expected Khazana Jewellery scraper module at ../../scraper/khazanajewellery/script.js')
  }
}

test('Khazana Jewellery local catalog captures the verified no-public-jobs careers surface', async () => {
  const { KHAZANA_JEWELLERY_CATALOG } = await loadCatalogModule()
  const khazanaJewellery = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KHAZANA_JEWELLERY_CATALOG)

  assert.equal(KHAZANA_JEWELLERY_CATALOG.source, 'khazanajewellery')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.companyName, 'Khazana Jewellery')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.officialBrandName, 'Khazana Jewellery')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.adapter, 'script')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.modulePath, '../../scraper/khazanajewellery/script.js')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.dryRunFile, 'khazanajewellery/jobs.json')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.homepageUrl, 'https://www.khazanajewellery.com/')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.companyCareerPage, 'https://www.khazanajewellery.com/careers.html')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.careersApplyEmail, 'careers@khazanajewellery.com')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.atsPlatform, 'official-careers-page-email-only')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.countryFilter, 'India')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.paginationStrategy, 'single-careers-page-no-listings')
  assert.equal(
    KHAZANA_JEWELLERY_CATALOG.extractionStrategy,
    'verified-careers-policy-page+email-apply-only+no-structured-public-job-listings',
  )
  assert.equal(KHAZANA_JEWELLERY_CATALOG.parser, 'custom-script')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.companyDomain, 'khazanajewellery.com')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.verifiedOn, '2026-08-17')
  assert.equal(KHAZANA_JEWELLERY_CATALOG.verifiedPublicPostingCount, 0)
  assert.match(KHAZANA_JEWELLERY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.khazanajewellery\.com\/careers\.html/i)
  assert.match(KHAZANA_JEWELLERY_CATALOG.verifiedSurfaceSummary, /careers@khazanajewellery\.com/i)
  assert.match(KHAZANA_JEWELLERY_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(KHAZANA_JEWELLERY_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(provider.source, 'khazanajewellery')
  assert.equal(provider.companyName, 'Khazana Jewellery')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.khazanajewellery.com/careers.html')
  assert.equal(provider.companyDomain, 'khazanajewellery.com')
  assert.match(provider.modulePath, /khazanajewellery[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /khazanajewellery[\\/]jobs\.json$/i)

  assert.equal(khazanaJewellery.PROVIDER_METADATA.source, provider.source)
  assert.equal(khazanaJewellery.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(khazanaJewellery.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(khazanaJewellery.CAREERS_APPLY_EMAIL, provider.careersApplyEmail)
})

test('Khazana Jewellery exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { KHAZANA_JEWELLERY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Khazana Jewellery\n',
    catalog: [hydrateProviderCatalogEntry(KHAZANA_JEWELLERY_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Khazana Jewellery', 'khazanajewellery', 'Khazana Jewellery']],
  )
})
