import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/huaya/catalog.js')
  } catch {
    assert.fail('Expected Huaya catalog module at ../../scraper/huaya/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/huaya/script.js')
  } catch {
    assert.fail('Expected Huaya scraper module at ../../scraper/huaya/script.js')
  }
}

test('Huaya local catalog captures the verified first-party no-public-jobs sentinel contract', async () => {
  const { HUAYA_CATALOG } = await loadCatalogModule()
  const huaya = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HUAYA_CATALOG)

  assert.equal(provider.source, 'huaya')
  assert.equal(provider.companyName, 'Huaya')
  assert.equal(provider.officialBrandName, 'Hebei Huaya Co., Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.huayaba.com/')
  assert.equal(provider.companyCareerPage, 'https://www.huayaba.com/')
  assert.equal(provider.aboutPageUrl, 'https://www.huayaba.com/about/')
  assert.equal(provider.sitemapUrl, 'https://www.huayaba.com/sitemap_index.xml')
  assert.equal(provider.companyDomain, 'huayaba.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-about-page-plus-sitemap-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-sitemap-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(HUAYA_CATALOG.modulePath, '../../scraper/huaya/script.js')
  assert.equal(HUAYA_CATALOG.dryRunFile, 'huaya/jobs.json')
  assert.match(provider.modulePath, /huaya[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /huaya[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /huayaba\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job listings/i)

  assert.equal(huaya.PROVIDER_METADATA.source, provider.source)
  assert.equal(huaya.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(huaya.ABOUT_PAGE_URL, provider.aboutPageUrl)
  assert.equal(huaya.SITEMAP_URL, provider.sitemapUrl)
})

test('Huaya exact-name and official-brand backlog rows resolve from local metadata without shared registry edits', async () => {
  const { HUAYA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Huaya\nHebei Huaya Co., Ltd.\n',
    catalog: [hydrateProviderCatalogEntry(HUAYA_CATALOG)],
    aliasMap: {
      'Hebei Huaya Co., Ltd.': 'huaya',
    },
  })

  assert.equal(report.totalRows, 2)
  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Huaya', 'huaya', 'Huaya'],
      ['Hebei Huaya Co., Ltd.', 'huaya', 'Huaya'],
    ],
  )
})

test('getScraperCatalog includes Huaya as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'huaya')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Huaya')
  assert.equal(provider.companyCareerPage, 'https://www.huayaba.com/')
  assert.equal(provider.companyDomain, 'huayaba.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /huaya[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Huaya scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'huaya')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'huaya')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /huaya[\\/]jobs\.json$/i)
})
