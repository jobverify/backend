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
const scriptModulePath = path.resolve(currentDir, '../../scraper/apeximports/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/apeximports/catalog.js')
  } catch {
    assert.fail('Expected Apex Imports catalog module at ../../scraper/apeximports/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/apeximports/script.js')
  } catch {
    assert.fail('Expected Apex Imports scraper module at ../../scraper/apeximports/script.js')
  }
}

test('Apex Imports local catalog captures the verified moved homepage and missing careers surface', async () => {
  const { APEX_IMPORTS_CATALOG } = await loadCatalogModule()
  const apex = await loadScriptModule()

  assert.equal(APEX_IMPORTS_CATALOG.source, 'apeximports')
  assert.equal(APEX_IMPORTS_CATALOG.companyName, 'Apex Imports')
  assert.equal(APEX_IMPORTS_CATALOG.adapter, 'script')
  assert.equal(APEX_IMPORTS_CATALOG.companyCareerPage, 'https://www.apeximports.com/')
  assert.equal(APEX_IMPORTS_CATALOG.homepageUrl, 'https://www.apeximports.com/')
  assert.equal(APEX_IMPORTS_CATALOG.robotsTxtUrl, 'https://www.apeximports.com/robots.txt')
  assert.equal(APEX_IMPORTS_CATALOG.sitemapUrl, 'https://www.apeximports.com/sitemap.xml')
  assert.equal(APEX_IMPORTS_CATALOG.companyDomain, 'apeximports.com')
  assert.equal(
    APEX_IMPORTS_CATALOG.atsPlatform,
    'official-company-site-no-public-careers',
  )
  assert.equal(APEX_IMPORTS_CATALOG.countryFilter, 'India')
  assert.equal(
    APEX_IMPORTS_CATALOG.paginationStrategy,
    'verified-moved-homepage-plus-robots-plus-missing-careers-route-validation',
  )
  assert.equal(
    APEX_IMPORTS_CATALOG.extractionStrategy,
    'verified-moved-homepage+verified-robots-txt+verified-missing-careers-and-sitemap-routes-return-empty',
  )
  assert.equal(APEX_IMPORTS_CATALOG.parser, 'custom-script')
  assert.equal(APEX_IMPORTS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(APEX_IMPORTS_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(APEX_IMPORTS_CATALOG.modulePath, scriptModulePath)
  assert.deepEqual(APEX_IMPORTS_CATALOG.careersRouteUrls, [
    'https://www.apeximports.com/careers',
    'https://www.apeximports.com/career',
    'https://www.apeximports.com/jobs',
    'https://www.apeximports.com/join-us',
    'https://www.apeximports.com/work-with-us',
    'https://www.apeximports.com/openings',
  ])
  assert.match(APEX_IMPORTS_CATALOG.verifiedSurfaceSummary, /Hanna Imports/i)
  assert.match(APEX_IMPORTS_CATALOG.verifiedSurfaceSummary, /Sanford Imports/i)
  assert.match(APEX_IMPORTS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(apex.PROVIDER_METADATA.source, APEX_IMPORTS_CATALOG.source)
  assert.equal(apex.PROVIDER_METADATA.companyName, APEX_IMPORTS_CATALOG.companyName)
})

test('Apex Imports backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { APEX_IMPORTS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APEX_IMPORTS_CATALOG)

  assert.equal(provider.companyName, 'Apex Imports')
  assert.equal(provider.companyDomain, 'apeximports.com')
  assert.match(provider.modulePath, /apeximports[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /apeximports[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apex Imports\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apex Imports', 'apeximports', 'Apex Imports']],
  )
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Apex Imports'),
    false,
  )
})

test('buildScrapers and company coverage resolve Apex Imports from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apeximports')
  const scraper = buildScrapers().find((item) => item.name === 'apeximports')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Apex Imports')
  assert.equal(provider.companyCareerPage, 'https://www.apeximports.com/')
  assert.match(scraper.dryRunFile, /apeximports[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apex Imports\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apex Imports', 'apeximports', 'Apex Imports']],
  )
})
