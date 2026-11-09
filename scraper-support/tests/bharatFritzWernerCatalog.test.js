import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/bharatfritzwerner/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bharatfritzwerner/catalog.js')
  } catch {
    assert.fail('Expected Bharat Fritz Werner catalog module at ../../scraper/bharatfritzwerner/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Bharat Fritz Werner local catalog captures the verified first-party public careers surface', async () => {
  const { BHARAT_FRITZ_WERNER_CATALOG } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(BHARAT_FRITZ_WERNER_CATALOG)

  assert.equal(provider.source, 'bharatfritzwerner')
  assert.equal(provider.companyName, 'Bharat Fritz Werner')
  assert.equal(provider.officialBrandName, 'BFW')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://bfwindia.com/careers/')
  assert.equal(provider.homepageUrl, 'https://bfwindia.com/')
  assert.equal(provider.careerAliasUrl, 'https://bfwindia.com/career/')
  assert.equal(provider.robotsTxtUrl, 'https://bfwindia.com/robots.txt')
  assert.equal(provider.sitemapIndexUrl, 'https://bfwindia.com/sitemap_index.xml')
  assert.equal(provider.pageSitemapUrl, 'https://bfwindia.com/page-sitemap.xml')
  assert.deepEqual(provider.noPublicJobRouteUrls, [
    'https://bfwindia.com/jobs/',
    'https://bfwindia.com/join-us/',
    'https://bfwindia.com/work-with-us/',
  ])
  assert.deepEqual(provider.verifiedJobDetailUrls, [
    'https://bfwindia.com/careers/head-of-application-engineering-1/',
    'https://bfwindia.com/careers/head-dept/',
    'https://bfwindia.com/careers/production-planning-and-control/',
    'https://bfwindia.com/careers/supply-chain-management/',
    'https://bfwindia.com/careers/head-of-quality/',
  ])
  assert.equal(provider.companyDomain, 'bfwindia.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-single-careers-page-plus-first-party-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page+visible-open-positions-list+same-domain-detail-pages+inline-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /bharatfritzwerner[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bfwindia\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bfwindia\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bfwindia\.com\/career\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/bfwindia\.com\/page-sitemap\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /visible Positions open block/i)
  assert.match(provider.verifiedSurfaceSummary, /Head of Application Engineering/i)
  assert.match(provider.verifiedSurfaceSummary, /Head \/ Dept Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Page not found - BFW/i)
})

test('Bharat Fritz Werner exact backlog name matches from the local provider contract without aliases', async () => {
  const { BHARAT_FRITZ_WERNER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Bharat Fritz Werner\n',
    catalog: [buildCatalogReadyProvider(BHARAT_FRITZ_WERNER_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat Fritz Werner', 'bharatfritzwerner', 'Bharat Fritz Werner']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Bharat Fritz Werner'), false)
})
