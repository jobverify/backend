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
const authorStreamModulePath = path.resolve(currentDir, '../../scraper/authorstream/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/authorstream/catalog.js')
  } catch {
    assert.fail('Expected AuthorStream catalog module at ../../scraper/authorstream/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/authorstream/script.js')
  } catch {
    assert.fail('Expected AuthorStream scraper module at ../../scraper/authorstream/script.js')
  }
}

test('AuthorStream local catalog captures the verified parked redirect shell and updated GoDaddy no-public-jobs sentinel state', async () => {
  const { AUTHORSTREAM_CATALOG } = await loadCatalogModule()
  const authorStream = await loadScriptModule()

  assert.equal(AUTHORSTREAM_CATALOG.source, 'authorstream')
  assert.equal(AUTHORSTREAM_CATALOG.companyName, 'AuthorStream')
  assert.equal(AUTHORSTREAM_CATALOG.officialBrandName, 'AuthorStream')
  assert.equal(AUTHORSTREAM_CATALOG.adapter, 'script')
  assert.equal(AUTHORSTREAM_CATALOG.companyCareerPage, 'https://authorstream.com/')
  assert.equal(AUTHORSTREAM_CATALOG.homepageUrl, 'https://authorstream.com/')
  assert.equal(AUTHORSTREAM_CATALOG.robotsTxtUrl, 'https://authorstream.com/robots.txt')
  assert.equal(AUTHORSTREAM_CATALOG.sitemapUrl, 'https://authorstream.com/sitemap.xml')
  assert.equal(AUTHORSTREAM_CATALOG.landerUrl, 'https://authorstream.com/lander')
  assert.deepEqual(AUTHORSTREAM_CATALOG.checkedRouteUrls, [
    'https://authorstream.com/careers',
    'https://authorstream.com/career',
    'https://authorstream.com/jobs',
    'https://authorstream.com/about',
    'https://authorstream.com/contact-us',
  ])
  assert.equal(AUTHORSTREAM_CATALOG.companyDomain, 'authorstream.com')
  assert.equal(AUTHORSTREAM_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(AUTHORSTREAM_CATALOG.countryFilter, 'India')
  assert.equal(
    AUTHORSTREAM_CATALOG.paginationStrategy,
    'verified-redirect-shell-plus-robots-sitemap-and-first-party-route-validation',
  )
  assert.equal(
    AUTHORSTREAM_CATALOG.extractionStrategy,
    'verified-redirect-shell+verified-robots-and-sitemap-with-single-lander-url+verified-first-party-routes-share-parked-redirect-or-all-routes-unreachable-return-empty',
  )
  assert.equal(AUTHORSTREAM_CATALOG.parser, 'custom-script')
  assert.equal(AUTHORSTREAM_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(AUTHORSTREAM_CATALOG.verifiedOn, '2026-08-07')
  assert.equal(AUTHORSTREAM_CATALOG.dryRunFile, 'authorstream/jobs.json')
  assert.equal(AUTHORSTREAM_CATALOG.modulePath, authorStreamModulePath)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /https:\/\/authorstream\.com\//i)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /\/lander/i)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /robots\.txt/i)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /sitemap/i)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /GoDaddy/i)
  assert.match(AUTHORSTREAM_CATALOG.verifiedSurfaceSummary, /no alternate official jobs surface/i)

  assert.equal(authorStream.PROVIDER_METADATA.source, AUTHORSTREAM_CATALOG.source)
  assert.equal(authorStream.PROVIDER_METADATA.companyName, AUTHORSTREAM_CATALOG.companyName)
  assert.equal(authorStream.PROVIDER_METADATA.landerUrl, AUTHORSTREAM_CATALOG.landerUrl)
})

test('AuthorStream local catalog hydrates into coverage without needing an alias entry', async () => {
  const { AUTHORSTREAM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(AUTHORSTREAM_CATALOG)

  assert.equal(provider.companyName, 'AuthorStream')
  assert.equal(provider.companyDomain, 'authorstream.com')
  assert.match(provider.modulePath, /authorstream[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /authorstream[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AuthorStream\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AuthorStream', 'authorstream', 'AuthorStream']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'AuthorStream'), false)
})

test('buildScrapers and company coverage resolve AuthorStream from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'authorstream')
  const scraper = buildScrapers().find((item) => item.name === 'authorstream')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AuthorStream')
  assert.equal(provider.companyCareerPage, 'https://authorstream.com/')
  assert.match(scraper.dryRunFile, /authorstream[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AuthorStream\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AuthorStream', 'authorstream', 'AuthorStream']],
  )
})
