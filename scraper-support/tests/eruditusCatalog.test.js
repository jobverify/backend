import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const eruditusModulePath = path.resolve(currentDir, '../../scraper/eruditus/script.js')

const loadEruditusCatalog = async () => {
  try {
    return await import('../../scraper/eruditus/catalog.js')
  } catch {
    assert.fail('Expected Eruditus catalog module at ../../scraper/eruditus/catalog.js')
  }
}

const loadEruditusModule = async () => {
  try {
    return await import('../../scraper/eruditus/script.js')
  } catch {
    assert.fail('Expected Eruditus scraper module at ../../scraper/eruditus/script.js')
  }
}

test('Eruditus local catalog captures the verified canonical homepage, crawl surfaces, and no-public-careers contract', async () => {
  const { ERUDITUS_CATALOG } = await loadEruditusCatalog()
  const eruditus = await loadEruditusModule()

  assert.equal(ERUDITUS_CATALOG.source, 'eruditus')
  assert.equal(ERUDITUS_CATALOG.companyName, 'Eruditus')
  assert.equal(ERUDITUS_CATALOG.officialBrandName, 'Eruditus Executive Education')
  assert.equal(ERUDITUS_CATALOG.adapter, 'script')
  assert.equal(ERUDITUS_CATALOG.homepageUrl, 'https://eruditus.com/')
  assert.equal(ERUDITUS_CATALOG.companyCareerPage, 'https://eruditus.com/careers')
  assert.equal(ERUDITUS_CATALOG.careerPageUrl, 'https://eruditus.com/careers')
  assert.equal(ERUDITUS_CATALOG.aboutUsUrl, 'https://eruditus.com/about-us/')
  assert.equal(ERUDITUS_CATALOG.robotsTxtUrl, 'https://eruditus.com/robots.txt')
  assert.equal(ERUDITUS_CATALOG.sitemapUrl, 'https://eruditus.com/sitemap.xml')
  assert.equal(ERUDITUS_CATALOG.sitemapIndexUrl, 'https://eruditus.com/sitemap_index.xml')
  assert.equal(ERUDITUS_CATALOG.pageSitemapUrl, 'https://eruditus.com/page-sitemap.xml')
  assert.deepEqual(ERUDITUS_CATALOG.checked404RouteUrls, [
    'https://eruditus.com/careers',
    'https://eruditus.com/career',
    'https://eruditus.com/jobs',
    'https://eruditus.com/join-us',
    'https://eruditus.com/work-with-us',
  ])
  assert.equal(ERUDITUS_CATALOG.companyDomain, 'eruditus.com')
  assert.equal(ERUDITUS_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(ERUDITUS_CATALOG.countryFilter, 'India')
  assert.equal(
    ERUDITUS_CATALOG.paginationStrategy,
    'validated-homepage-plus-robots-and-page-sitemap-plus-common-404-careers-routes',
  )
  assert.equal(
    ERUDITUS_CATALOG.extractionStrategy,
    'verified-homepage-without-careers-link+verified-robots-and-page-sitemap-without-careers-route+verified-common-careers-routes-return-404+return-empty',
  )
  assert.equal(ERUDITUS_CATALOG.parser, 'custom-script')
  assert.equal(ERUDITUS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ERUDITUS_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ERUDITUS_CATALOG.dryRunFile, 'eruditus/jobs.json')
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /https:\/\/eruditus\.com\/$/i)
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /https:\/\/eruditus\.com\/robots\.txt/i)
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /https:\/\/eruditus\.com\/page-sitemap\.xml/i)
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /https:\/\/eruditus\.com\/careers/i)
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(ERUDITUS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(ERUDITUS_CATALOG.modulePath, eruditusModulePath)

  assert.equal(eruditus.PROVIDER_METADATA.source, ERUDITUS_CATALOG.source)
  assert.equal(eruditus.PROVIDER_METADATA.companyName, ERUDITUS_CATALOG.companyName)
  assert.equal(eruditus.PROVIDER_METADATA.careerPageUrl, ERUDITUS_CATALOG.careerPageUrl)
  assert.equal(eruditus.PROVIDER_METADATA.pageSitemapUrl, ERUDITUS_CATALOG.pageSitemapUrl)
})

test('Eruditus backlog row hydrates locally without needing an alias entry', async () => {
  const { ERUDITUS_CATALOG } = await loadEruditusCatalog()
  const provider = hydrateProviderCatalogEntry(ERUDITUS_CATALOG)

  assert.equal(provider.companyName, 'Eruditus')
  assert.equal(provider.companyDomain, 'eruditus.com')
  assert.match(provider.modulePath, /eruditus[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /eruditus[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Eruditus'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Eruditus\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eruditus', 'eruditus', 'Eruditus']],
  )
})
