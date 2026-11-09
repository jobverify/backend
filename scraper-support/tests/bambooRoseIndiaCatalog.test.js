import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const bambooRoseIndiaModulePath = path.resolve(currentDir, '../../scraper/bambooroseindia/script.js')

const loadBambooRoseIndiaCatalog = async () => {
  try {
    return await import('../../scraper/bambooroseindia/catalog.js')
  } catch {
    assert.fail('Expected Bamboo Rose India catalog module at ../../scraper/bambooroseindia/catalog.js')
  }
}

const loadBambooRoseIndiaModule = async () => {
  try {
    return await import('../../scraper/bambooroseindia/script.js')
  } catch {
    assert.fail('Expected Bamboo Rose India scraper module at ../../scraper/bambooroseindia/script.js')
  }
}

test('Bamboo Rose India local catalog captures the verified first-party careers page and no-public-jobs sentinel contract', async () => {
  const { BAMBOO_ROSE_INDIA_CATALOG } = await loadBambooRoseIndiaCatalog()
  const bambooRoseIndia = await loadBambooRoseIndiaModule()

  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.source, 'bambooroseindia')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.companyName, 'Bamboo Rose India')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.officialBrandName, 'Bamboo Rose')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.adapter, 'script')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.homepageUrl, 'https://bamboorose.com/')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.companyCareerPage, 'https://bamboorose.com/careers/')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.careerPageUrl, 'https://bamboorose.com/careers/')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.linkedinJobsUrl, 'https://www.linkedin.com/company/bamboorose/jobs/')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.sitemapIndexUrl, 'https://bamboorose.com/sitemap_index.xml')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.pageSitemapUrl, 'https://bamboorose.com/page-sitemap.xml')
  assert.deepEqual(BAMBOO_ROSE_INDIA_CATALOG.checkedMissingRouteUrls, [
    'https://bamboorose.com/jobs/',
    'https://bamboorose.com/career/',
    'https://bamboorose.com/join-us/',
    'https://bamboorose.com/openings/',
  ])
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.companyDomain, 'bamboorose.com')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    BAMBOO_ROSE_INDIA_CATALOG.paginationStrategy,
    'homepage-plus-careers-page-plus-common-route-404-validation',
  )
  assert.equal(
    BAMBOO_ROSE_INDIA_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-linkedin-handoff+verified-missing-common-routes-return-empty',
  )
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.dryRunFile, 'bambooroseindia/jobs.json')
  assert.match(BAMBOO_ROSE_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/bamboorose\.com\//i)
  assert.match(BAMBOO_ROSE_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/bamboorose\.com\/careers\//i)
  assert.match(
    BAMBOO_ROSE_INDIA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.linkedin\.com\/company\/bamboorose\/jobs\//i,
  )
  assert.match(BAMBOO_ROSE_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/bamboorose\.com\/page-sitemap\.xml/i)
  assert.match(BAMBOO_ROSE_INDIA_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(BAMBOO_ROSE_INDIA_CATALOG.modulePath, bambooRoseIndiaModulePath)

  assert.equal(bambooRoseIndia.PROVIDER_METADATA.source, BAMBOO_ROSE_INDIA_CATALOG.source)
  assert.equal(bambooRoseIndia.PROVIDER_METADATA.companyName, BAMBOO_ROSE_INDIA_CATALOG.companyName)
  assert.equal(
    bambooRoseIndia.PROVIDER_METADATA.linkedinJobsUrl,
    BAMBOO_ROSE_INDIA_CATALOG.linkedinJobsUrl,
  )
})

test('Bamboo Rose India backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { BAMBOO_ROSE_INDIA_CATALOG } = await loadBambooRoseIndiaCatalog()
  const provider = hydrateProviderCatalogEntry(BAMBOO_ROSE_INDIA_CATALOG)

  assert.equal(provider.companyName, 'Bamboo Rose India')
  assert.equal(provider.companyDomain, 'bamboorose.com')
  assert.match(provider.modulePath, /bambooroseindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /bambooroseindia[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bamboo Rose India'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Bamboo Rose India\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bamboo Rose India', 'bambooroseindia', 'Bamboo Rose India']],
  )
})

test('buildScrapers and company coverage resolve Bamboo Rose India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bambooroseindia')
  const scraper = buildScrapers().find((item) => item.name === 'bambooroseindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Bamboo Rose India')
  assert.equal(provider.companyCareerPage, 'https://bamboorose.com/careers/')
  assert.match(scraper.dryRunFile, /bambooroseindia[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Bamboo Rose India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bamboo Rose India', 'bambooroseindia', 'Bamboo Rose India']],
  )
})
