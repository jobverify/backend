import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const astraMicrowaveModulePath = path.resolve(currentDir, '../../scraper/astramicrowave/script.js')

const loadAstraMicrowaveCatalog = async () => {
  try {
    return await import('../../scraper/astramicrowave/catalog.js')
  } catch {
    assert.fail('Expected Astra Microwave catalog module at ../../scraper/astramicrowave/catalog.js')
  }
}

test('Astra Microwave catalog captures the verified first-party nonlisting careers surface', async () => {
  const { ASTRA_MICROWAVE_CATALOG } = await loadAstraMicrowaveCatalog()
  const provider = hydrateProviderCatalogEntry(ASTRA_MICROWAVE_CATALOG)

  assert.equal(provider.source, 'astramicrowave')
  assert.equal(provider.companyName, 'Astra Microwave')
  assert.equal(provider.officialBrandName, 'Astra Microwave Products Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://astramwp.com/post-resume/')
  assert.equal(provider.homepageUrl, 'https://www.astramwp.com/')
  assert.equal(provider.careersAliasUrl, 'https://astramwp.com/post-resume-2/')
  assert.equal(provider.robotsTxtUrl, 'https://www.astramwp.com/robots.txt')
  assert.equal(provider.sitemapIndexUrl, 'https://astramwp.com/wp-sitemap.xml')
  assert.equal(provider.pageSitemapUrl, 'https://astramwp.com/wp-sitemap-posts-page-1.xml')
  assert.equal(provider.applicationEmail, 'hr@astramwp.com')
  assert.equal(provider.applicationUrl, 'mailto:hr@astramwp.com')
  assert.deepEqual(provider.careersSectionPageUrls, [
    'https://astramwp.com/our-culture/',
    'https://astramwp.com/learning-development/',
    'https://astramwp.com/post-resume/',
    'https://astramwp.com/post-resume-2/',
  ])
  assert.deepEqual(provider.blockedJobRouteUrls, [
    'https://www.astramwp.com/careers',
    'https://www.astramwp.com/career',
    'https://www.astramwp.com/jobs',
    'https://www.astramwp.com/join-us',
    'https://www.astramwp.com/openings',
  ])
  assert.deepEqual(provider.missingJobRouteUrls, [
    'https://www.astramwp.com/work-with-us',
  ])
  assert.equal(provider.companyDomain, 'astramwp.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-robots-and-wordpress-page-sitemap-plus-resume-only-careers-pages-and-adjacent-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-robots-and-sitemaps+verified-post-resume-pages-without-public-listings+verified-blocked-and-missing-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, astraMicrowaveModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.astramwp\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/astramwp\.com\/wp-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/astramwp\.com\/wp-sitemap-posts-page-1\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/astramwp\.com\/post-resume\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/astramwp\.com\/post-resume-2\//i)
  assert.match(provider.verifiedSurfaceSummary, /hr@astramwp\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /403 Access Denied/i)
  assert.match(provider.verifiedSurfaceSummary, /work-with-us/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Astra Microwave backlog row matches directly from provider metadata without aliases', async () => {
  const { ASTRA_MICROWAVE_CATALOG } = await loadAstraMicrowaveCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Astra Microwave\n',
    catalog: [hydrateProviderCatalogEntry(ASTRA_MICROWAVE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Astra Microwave', 'astramicrowave', 'Astra Microwave']],
  )
})

test('buildScrapers and company coverage resolve Astra Microwave from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'astramicrowave')
  const scraper = buildScrapers().find((item) => item.name === 'astramicrowave')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Astra Microwave')
  assert.equal(provider.companyCareerPage, 'https://astramwp.com/post-resume/')
  assert.match(scraper.dryRunFile, /astramicrowave[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Astra Microwave\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Astra Microwave', 'astramicrowave', 'Astra Microwave']],
  )
})
