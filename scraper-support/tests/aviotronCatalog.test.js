import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const aviotronModulePath = path.resolve(currentDir, '../../scraper/aviotron/script.js')

const loadAviotronCatalog = async () => {
  try {
    return await import('../../scraper/aviotron/catalog.js')
  } catch {
    assert.fail('Expected Aviotron catalog module at ../../scraper/aviotron/catalog.js')
  }
}

test('Aviotron catalog captures the verified first-party no-public-jobs placeholder surface', async () => {
  const { AVIOTRON_CATALOG } = await loadAviotronCatalog()
  const provider = hydrateProviderCatalogEntry(AVIOTRON_CATALOG)

  assert.equal(provider.source, 'aviotron')
  assert.equal(provider.companyName, 'Aviotron')
  assert.equal(provider.officialBrandName, 'Aviotron')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://aviotron.com/')
  assert.equal(provider.homepageUrl, 'https://aviotron.com/')
  assert.equal(provider.robotsTxtUrl, 'https://aviotron.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://aviotron.com/sitemap.xml')
  assert.deepEqual(provider.noPublicJobRouteUrls, [
    'https://aviotron.com/careers',
    'https://aviotron.com/career',
    'https://aviotron.com/join-us',
    'https://aviotron.com/work-with-us',
    'https://aviotron.com/openings',
  ])
  assert.equal(provider.untrustedJobRouteUrl, 'https://aviotron.com/jobs')
  assert.equal(provider.companyDomain, 'aviotron.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-placeholder-homepage-plus-robots-and-sitemap-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-launching-soon-homepage+verified-robots-and-sitemap-without-careers+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.modulePath, aviotronModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aviotron\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aviotron\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aviotron\.com\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /verified no-public-careers routes/i)
  assert.match(provider.verifiedSurfaceSummary, /UND_ERR_CONNECT_TIMEOUT/i)
  assert.match(provider.verifiedSurfaceSummary, /Launching Soon/i)
  assert.match(provider.verifiedSurfaceSummary, /temporarily unreachable from this environment/i)
})

test('Aviotron backlog row matches directly from provider metadata without aliases', async () => {
  const { AVIOTRON_CATALOG } = await loadAviotronCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Aviotron\n',
    catalog: [hydrateProviderCatalogEntry(AVIOTRON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aviotron', 'aviotron', 'Aviotron']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Aviotron'), false)
})

test('buildScrapers and company coverage resolve Aviotron from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aviotron')
  const scraper = buildScrapers().find((item) => item.name === 'aviotron')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aviotron')
  assert.equal(provider.companyCareerPage, 'https://aviotron.com/')

  const report = generateCompanyCoverageReport({
    csvText: 'Aviotron\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aviotron', 'aviotron', 'Aviotron']],
  )
})
