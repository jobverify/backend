import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kalelogistics/catalog.js')
  } catch {
    assert.fail('Expected Kale Logistics catalog module at ../../scraper/kalelogistics/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kalelogistics/script.js')
  } catch {
    assert.fail('Expected Kale Logistics scraper module at ../../scraper/kalelogistics/script.js')
  }
}

test('Kale Logistics local catalog captures the verified first-party Darwinbox handoff surface', async () => {
  const { KALE_LOGISTICS_CATALOG } = await loadCatalogModule()
  const kaleLogistics = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KALE_LOGISTICS_CATALOG)

  assert.equal(KALE_LOGISTICS_CATALOG.source, 'kalelogistics')
  assert.equal(KALE_LOGISTICS_CATALOG.companyName, 'Kale Logistics')
  assert.equal(KALE_LOGISTICS_CATALOG.officialBrandName, 'Kalé Logistics Solutions')
  assert.equal(KALE_LOGISTICS_CATALOG.adapter, 'script')
  assert.equal(KALE_LOGISTICS_CATALOG.modulePath, '../../scraper/kalelogistics/script.js')
  assert.equal(KALE_LOGISTICS_CATALOG.dryRunFile, 'kalelogistics/jobs.json')
  assert.equal(KALE_LOGISTICS_CATALOG.homepageUrl, 'https://www.kalelogistics.com/')
  assert.equal(KALE_LOGISTICS_CATALOG.companyCareerPage, 'https://www.kalelogistics.com/careers')
  assert.equal(
    KALE_LOGISTICS_CATALOG.officialCareersHandoffUrl,
    'https://kale.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(KALE_LOGISTICS_CATALOG.darwinboxOrigin, 'https://kale.darwinbox.in')
  assert.equal(KALE_LOGISTICS_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(KALE_LOGISTICS_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(KALE_LOGISTICS_CATALOG.countryFilter, 'India')
  assert.equal(KALE_LOGISTICS_CATALOG.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(KALE_LOGISTICS_CATALOG.extractionStrategy, 'official-careers-page+darwinbox-listing-api')
  assert.equal(KALE_LOGISTICS_CATALOG.parser, 'custom-script')
  assert.equal(KALE_LOGISTICS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KALE_LOGISTICS_CATALOG.companyDomain, 'kalelogistics.com')
  assert.equal(KALE_LOGISTICS_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(KALE_LOGISTICS_CATALOG.verifiedPublicPostingCount, 2)
  assert.match(KALE_LOGISTICS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.kalelogistics\.com\/careers/i)
  assert.match(KALE_LOGISTICS_CATALOG.verifiedSurfaceSummary, /https:\/\/kale\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home/i)
  assert.match(KALE_LOGISTICS_CATALOG.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(KALE_LOGISTICS_CATALOG.verifiedSurfaceSummary, /2 India jobs/i)

  assert.equal(provider.source, 'kalelogistics')
  assert.equal(provider.companyName, 'Kale Logistics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kalelogistics.com/careers')
  assert.equal(provider.companyDomain, 'kalelogistics.com')
  assert.match(provider.modulePath, /kalelogistics[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kalelogistics[\\/]jobs\.json$/i)

  assert.equal(kaleLogistics.PROVIDER_METADATA.source, provider.source)
  assert.equal(kaleLogistics.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(kaleLogistics.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
  assert.equal(kaleLogistics.OFFICIAL_CAREERS_HANDOFF_URL, provider.officialCareersHandoffUrl)
  assert.equal(kaleLogistics.DARWINBOX_ORIGIN, provider.darwinboxOrigin)
})

test('Kale Logistics exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { KALE_LOGISTICS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Kale Logistics\n',
    catalog: [hydrateProviderCatalogEntry(KALE_LOGISTICS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kale Logistics', 'kalelogistics', 'Kale Logistics']],
  )
})
