import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ironmountainindia/catalog.js')
  } catch {
    assert.fail('Expected Iron Mountain India catalog module at ../../scraper/ironmountainindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ironmountainindia/script.js')
  } catch {
    assert.fail('Expected Iron Mountain India scraper module at ../../scraper/ironmountainindia/script.js')
  }
}

test('Iron Mountain India local catalog captures the verified first-party NLX sitemap contract', async () => {
  const { IRON_MOUNTAIN_INDIA_CATALOG } = await loadCatalogModule()
  const ironMountainIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(IRON_MOUNTAIN_INDIA_CATALOG)

  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.source, 'ironmountainindia')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.companyName, 'Iron Mountain India')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.officialBrandName, 'Iron Mountain')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.adapter, 'script')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.modulePath, '../ironmountainindia/script.js')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.dryRunFile, 'ironmountainindia/jobs.json')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.homepageUrl, 'https://www.ironmountain.com/en-in')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.aboutPageUrl, 'https://www.ironmountain.com/about-us')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.companyCareerPage, 'https://ironmountain.jobs/')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.jobsBoardUrl, 'https://ironmountain.jobs/')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.jobsSitemapUrl, 'https://ironmountain.jobs/sitemaps/jobs_1.xml')
  assert.equal(
    IRON_MOUNTAIN_INDIA_CATALOG.verifiedSampleJobUrl,
    'https://ironmountain.jobs/navi-mumbai-ind/project-accounting-professional/3E5B9F4951D04C2B88CB21B5658F3CC1/job/',
  )
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.atsPlatform, 'nlx')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    IRON_MOUNTAIN_INDIA_CATALOG.paginationStrategy,
    'official-careers-handoff-plus-public-jobs-sitemap',
  )
  assert.equal(
    IRON_MOUNTAIN_INDIA_CATALOG.extractionStrategy,
    'official-about-page+official-nlx-board+public-jobs-sitemap+india-url-filter',
  )
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.companyDomain, 'ironmountain.com')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.verifiedOn, '2026-08-03')
  assert.equal(IRON_MOUNTAIN_INDIA_CATALOG.verifiedPublicPostingCount, 16)
  assert.match(IRON_MOUNTAIN_INDIA_CATALOG.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(IRON_MOUNTAIN_INDIA_CATALOG.verifiedSurfaceSummary, /ironmountain\.com\/about-us/i)
  assert.match(IRON_MOUNTAIN_INDIA_CATALOG.verifiedSurfaceSummary, /ironmountain\.jobs/i)
  assert.match(IRON_MOUNTAIN_INDIA_CATALOG.verifiedSurfaceSummary, /jobs_1\.xml/i)
  assert.match(IRON_MOUNTAIN_INDIA_CATALOG.verifiedSurfaceSummary, /16 India detail URLs/i)

  assert.equal(provider.source, 'ironmountainindia')
  assert.equal(provider.companyName, 'Iron Mountain India')
  assert.equal(provider.officialBrandName, 'Iron Mountain')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ironmountain.jobs/')
  assert.equal(provider.companyDomain, 'ironmountain.com')
  assert.match(provider.modulePath, /ironmountainindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ironmountainindia[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Iron Mountain India'), false)

  assert.equal(ironMountainIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(ironMountainIndia.HOMEPAGE_URL, provider.homepageUrl)
  assert.equal(ironMountainIndia.ABOUT_PAGE_URL, provider.aboutPageUrl)
  assert.equal(ironMountainIndia.CAREERS_URL, provider.companyCareerPage)
  assert.equal(ironMountainIndia.JOBS_SITEMAP_URL, provider.jobsSitemapUrl)
})

test('Iron Mountain India exact-name backlog rows resolve directly from local provider metadata', async () => {
  const { IRON_MOUNTAIN_INDIA_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Iron Mountain India\n',
    catalog: [hydrateProviderCatalogEntry(IRON_MOUNTAIN_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Iron Mountain India', 'ironmountainindia', 'Iron Mountain India']],
  )
})

test('getScraperCatalog includes Iron Mountain India as a verified NLX sitemap provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ironmountainindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Iron Mountain India')
  assert.equal(provider.companyCareerPage, 'https://ironmountain.jobs/')
  assert.equal(provider.companyDomain, 'ironmountain.com')
  assert.equal(provider.atsPlatform, 'nlx')
  assert.match(provider.modulePath, /ironmountainindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Iron Mountain India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ironmountainindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ironmountainindia')
  assert.equal(scraper.provider.atsPlatform, 'nlx')
  assert.match(scraper.dryRunFile, /ironmountainindia[\\/]jobs\.json$/i)
})
