import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/aavishkar/provider.js')
  } catch {
    assert.fail('Expected Aavishkar provider module at ../../scraper/aavishkar/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/aavishkar/script.js')
  } catch {
    assert.fail('Expected Aavishkar scraper module at ../../scraper/aavishkar/script.js')
  }
}

const aliasMap = {
  Aavishkaar: 'aavishkar',
  'Aavishkaar Group': 'aavishkar',
}

test('Aavishkar exports local provider metadata for the verified Aavishkaar Group no-public-jobs surface', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'aavishkar',
    companyName: 'Aavishkar',
    officialBrandName: 'Aavishkaar Group',
    adapter: 'script',
    modulePath: '../../scraper/aavishkar/script.js',
    companyCareerPage: 'https://aavishkaargroup.com/',
    companyDomain: 'aavishkaargroup.com',
    contactPageUrl: 'https://aavishkaargroup.com/contact-us/',
    robotsTxtUrl: 'https://aavishkaargroup.com/robots.txt',
    sitemapUrl: 'https://aavishkaargroup.com/sitemap.xml',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    paginationStrategy: 'homepage-plus-contact-plus-robots-plus-sitemap-plus-common-careers-404-validation',
    extractionStrategy:
      'verified-group-homepage+verified-contact-page+verified-robots-and-sitemap+verified-missing-first-party-careers-routes-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary:
      'Verified on July 14, 2026 that https://aavishkaargroup.com/ is the live Aavishkaar Group first-party site for the backlog row Aavishkar, https://aavishkaargroup.com/contact-us/ is the live contact page, robots.txt and the Yoast sitemap index expose only first-party informational routes, and common careers or jobs routes return first-party 404 pages. No trustworthy public jobs surface is currently exposed.',
    dryRunFile: 'aavishkar/jobs.json',
  })

  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.OFFICIAL_BRAND_NAME, providerModule.provider.officialBrandName)
  assert.equal(scriptModule.HOMEPAGE_URL, providerModule.provider.companyCareerPage)
})

test('Aavishkar local provider contract hydrates into coverage with the expected alias snippet', async () => {
  const providerModule = await loadProviderModule()
  const hydratedProvider = hydrateProviderCatalogEntry(providerModule.provider)

  assert.equal(hydratedProvider.companyName, 'Aavishkar')
  assert.equal(hydratedProvider.companyDomain, 'aavishkaargroup.com')
  assert.match(hydratedProvider.modulePath, /aavishkar[\\/]script\.js$/i)
  assert.match(hydratedProvider.dryRunFile, /aavishkar[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aavishkar\nAavishkaar\nAavishkaar Group\n',
    catalog: [hydratedProvider],
    aliasMap,
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Aavishkar', 'aavishkar', 'Aavishkar'],
      ['Aavishkaar', 'aavishkar', 'Aavishkar'],
      ['Aavishkaar Group', 'aavishkar', 'Aavishkar'],
    ],
  )
})

test('buildScrapers and company coverage resolve Aavishkar from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aavishkar')
  const scraper = buildScrapers().find((item) => item.name === 'aavishkar')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aavishkar')
  assert.equal(provider.companyCareerPage, 'https://aavishkaargroup.com/')
  assert.match(scraper.dryRunFile, /aavishkar[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aavishkar\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aavishkar', 'aavishkar', 'Aavishkar']],
  )
})
