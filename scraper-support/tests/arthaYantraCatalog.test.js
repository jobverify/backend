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
const arthaYantraModulePath = path.resolve(currentDir, '../../scraper/arthayantra/script.js')

const loadArthaYantraCatalog = async () => {
  try {
    return await import('../../scraper/arthayantra/catalog.js')
  } catch {
    assert.fail('Expected ArthaYantra catalog module at ../../scraper/arthayantra/catalog.js')
  }
}

test('ArthaYantra catalog captures the verified first-party broken no-public-jobs surface', async () => {
  const { ARTHAYANTRA_CATALOG } = await loadArthaYantraCatalog()
  const provider = hydrateProviderCatalogEntry(ARTHAYANTRA_CATALOG)

  assert.equal(provider.source, 'arthayantra')
  assert.equal(provider.companyName, 'ArthaYantra')
  assert.equal(provider.officialBrandName, 'ARTHOS Financial Planning')
  assert.equal(provider.legalEntityName, 'Arthayantra Corp. Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.arthayantra.com/')
  assert.equal(provider.homepageRedirectUrl, 'https://arthos.arthayantra.com/login.html')
  assert.equal(provider.companyDomain, 'arthayantra.com')
  assert.equal(provider.robotsTxtUrl, 'https://arthayantra.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://arthayantra.com/sitemap.xml')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-redirect-plus-sitemap-plus-broken-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-login-redirect+verified-sitemap+verified-broken-robots-and-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, arthaYantraModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arthayantra\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/arthos\.arthayantra\.com\/login\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/arthayantra\.com\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/arthayantra\.com\/robots\.txt/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arthayantra\.com\/financial-consultant-careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arthayantra\.com\/career-fa\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arthayantra\.com\/career-fp\//i)
  assert.match(provider.verifiedSurfaceSummary, /critical error/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('ArthaYantra backlog row matches directly from provider metadata without aliases', async () => {
  const { ARTHAYANTRA_CATALOG } = await loadArthaYantraCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'ArthaYantra\n',
    catalog: [hydrateProviderCatalogEntry(ARTHAYANTRA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ArthaYantra', 'arthayantra', 'ArthaYantra']],
  )
})

test('buildScrapers and company coverage resolve ArthaYantra from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arthayantra')
  const scraper = buildScrapers().find((item) => item.name === 'arthayantra')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'ArthaYantra')
  assert.equal(provider.companyCareerPage, 'https://www.arthayantra.com/')
  assert.match(scraper.dryRunFile, /arthayantra[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'ArthaYantra\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ArthaYantra', 'arthayantra', 'ArthaYantra']],
  )
})
