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
const otoCapitalModulePath = path.resolve(currentDir, '../../scraper/otocapital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/otocapital/catalog.js')
  } catch {
    assert.fail('Expected OTO Capital catalog module at ../../scraper/otocapital/catalog.js')
  }
}

test('OTO Capital local catalog captures the verified first-party no-public-careers state', async () => {
  const {
    OTO_CAPITAL_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OTO_CAPITAL_CATALOG)

  assert.equal(defaultCatalog, OTO_CAPITAL_CATALOG)
  assert.equal(provider.source, 'otocapital')
  assert.equal(provider.companyName, 'OTO Capital')
  assert.equal(provider.officialBrandName, 'OTO')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.otocapital.in/')
  assert.equal(provider.companyCareerPage, 'https://www.otocapital.in/careers')
  assert.equal(provider.companyDomain, 'otocapital.in')
  assert.equal(provider.officialSitemapUrl, 'https://www.otocapital.in/sitemap.xml')
  assert.equal(provider.officialJobsPageUrl, 'https://www.otocapital.in/jobs')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-sitemap-plus-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-sitemap-without-careers+verified-careers-and-jobs-routes-404-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.otocapital\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.otocapital\.in\/sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /OTO Capital - Not Found/i)
  assert.equal(provider.modulePath, otoCapitalModulePath)
  assert.match(provider.dryRunFile, /otocapital[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OTO Capital'), false)
})

test('OTO Capital backlog row matches directly from the local catalog metadata', async () => {
  const { OTO_CAPITAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OTO Capital\n',
    catalog: [OTO_CAPITAL_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OTO Capital', 'otocapital', 'OTO Capital']],
  )
})

test('getScraperCatalog exposes OTO Capital as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'otocapital')
  const scraper = buildScrapers().find((item) => item.name === 'otocapital')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OTO Capital')
  assert.equal(provider.companyCareerPage, 'https://www.otocapital.in/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OTO Capital'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OTO Capital\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OTO Capital', 'otocapital', 'OTO Capital']],
  )
})
