import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mindbowserModulePath = path.resolve(currentDir, '../../scraper/mindbowser/script.js')

const loadMindbowserCatalog = async () => {
  try {
    return await import('../../scraper/mindbowser/catalog.js')
  } catch {
    assert.fail('Expected Mindbowser catalog module at ../../scraper/mindbowser/catalog.js')
  }
}

test('Mindbowser local catalog captures the verified first-party careers handoff and API-only opaque-shell fallback metadata', async () => {
  const {
    MINDBOWSER_CATALOG,
    default: defaultCatalog,
  } = await loadMindbowserCatalog()
  const provider = hydrateProviderCatalogEntry(MINDBOWSER_CATALOG)

  assert.equal(defaultCatalog, MINDBOWSER_CATALOG)
  assert.equal(provider.source, 'mindbowser')
  assert.equal(provider.companyName, 'Mindbowser')
  assert.equal(provider.officialBrandName, 'Mindbowser')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.mindbowser.com/careers/')
  assert.equal(provider.officialHomepageUrl, 'https://www.mindbowser.com/')
  assert.equal(provider.hroneShortUrl, 'https://hr-1.in/829c17')
  assert.equal(provider.atsPlatform, 'hrone')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-opaque-hrone-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-hrone-handoff+api-only-empty-fallback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mindbowser.com')
  assert.equal(provider.verifiedRenderedJobCount, 6)
  assert.equal(provider.verifiedSampleJobId, 'JO00115')
  assert.equal(provider.verifiedOn, '2026-08-08')
  assert.match(provider.dryRunFile, /mindbowser[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /mindbowser[\\/]script\.js$/i)
  assert.equal(provider.modulePath, mindbowserModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 8, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mindbowser\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hr-1\.in\/829c17/i)
  assert.match(provider.verifiedSurfaceSummary, /opaque public career-portal shell/i)
  assert.match(provider.verifiedSurfaceSummary, /honest empty result by default/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /\b6 public vacancies\b/i)
  assert.match(provider.verifiedSurfaceSummary, /JO00115/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior AI\/ML Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Technology Role/i)
})

test('Mindbowser backlog row matches directly from the local catalog metadata without aliases', async () => {
  const { MINDBOWSER_CATALOG } = await loadMindbowserCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Mindbowser\n',
    catalog: [hydrateProviderCatalogEntry(MINDBOWSER_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mindbowser', 'mindbowser', 'Mindbowser']],
  )
})
