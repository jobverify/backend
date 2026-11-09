import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eko/catalog.js')
  } catch {
    assert.fail('Expected Eko catalog module at ../../scraper/eko/catalog.js')
  }
}

const loadEkoModule = async () => {
  try {
    return await import('../../scraper/eko/script.js')
  } catch {
    assert.fail('Expected Eko scraper module at ../../scraper/eko/script.js')
  }
}

test('Eko local catalog captures the verified first-party no-public-careers surface without aliases', async () => {
  const { EKO_CATALOG } = await loadCatalogModule()
  const eko = await loadEkoModule()
  const provider = hydrateProviderCatalogEntry(EKO_CATALOG)

  assert.equal(provider.source, 'eko')
  assert.equal(provider.companyName, 'Eko')
  assert.equal(provider.officialBrandName, 'Eko Bharat Ventures Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /eko[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, 'https://eko.in/')
  assert.equal(provider.companyDomain, 'eko.in')
  assert.equal(provider.corporateHomepageUrl, 'https://about.eko.in/')
  assert.equal(provider.robotsTxtUrl, 'https://eko.in/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://eko.in/sitemap.xml')
  assert.equal(provider.corporateRobotsTxtUrl, 'https://about.eko.in/robots.txt')
  assert.equal(provider.corporateSitemapUrl, 'https://about.eko.in/sitemap.xml')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-corporate-homepage-plus-crawl-surface-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-corporate-homepage+verified-crawl-surfaces-without-careers+verified-missing-common-careers-routes+incomplete-discovery',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.zeroResultPolicy, 'discovery-only')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/eko\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/about\.eko\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/eko\.in\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/eko\.in\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/about\.eko\.in\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /unknown/i)
  assert.match(provider.verifiedSurfaceSummary, /incomplete discovery/i)
  const shared = getScraperCatalog().find(entry => entry.source === 'eko')
  for (const key of ['verifiedOn', 'extractionStrategy', 'verifiedSurfaceSummary', 'verifiedPublicJobCount', 'verifiedIndiaJobCount', 'zeroResultPolicy']) {
    assert.deepEqual(shared[key], provider[key], key)
  }
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Eko'), false)

  assert.equal(eko.PROVIDER_METADATA.source, EKO_CATALOG.source)
  assert.equal(eko.PROVIDER_METADATA.companyName, EKO_CATALOG.companyName)
  assert.equal(eko.PROVIDER_METADATA.companyCareerPage, EKO_CATALOG.companyCareerPage)
})

test('Eko backlog row matches directly from local provider metadata without alias churn', async () => {
  const { EKO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Eko\n',
    catalog: [hydrateProviderCatalogEntry(EKO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eko', 'eko', 'Eko']],
  )
})
