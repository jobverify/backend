import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/dealshare/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dealshare/catalog.js')
  } catch {
    assert.fail('Expected DealShare catalog module at ../../scraper/dealshare/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('DealShare local catalog captures the verified first-party homepage, SPA careers route, and no-public-jobs state without alias churn', async () => {
  const {
    DEAL_SHARE_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(DEAL_SHARE_CATALOG)

  assert.equal(defaultCatalog, DEAL_SHARE_CATALOG)
  assert.equal(provider.source, 'dealshare')
  assert.equal(provider.companyName, 'DealShare')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://about.dealshare.in/careers')
  assert.equal(provider.homepageUrl, 'https://www.dealshare.in/')
  assert.equal(provider.aboutHubUrl, 'https://about.dealshare.in/')
  assert.equal(provider.directCareersRouteUrl, 'https://about.dealshare.in/careers')
  assert.equal(provider.companyDomain, 'dealshare.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-spa-about-hub-plus-access-denied-direct-careers-route',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-hub-spa-shell+verified-spa-bundle-about-and-careers-copy-without-openings+verified-direct-careers-route-access-denied-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-08')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dealshare[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dealshare\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/about\.dealshare\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/about\.dealshare\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /\bSPA shell\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bJS bundle\b/i)
  assert.match(provider.verifiedSurfaceSummary, /AccessDenied/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DealShare'), false)
})

test('DealShare backlog row matches directly from the local provider metadata without an alias entry', async () => {
  const { DEAL_SHARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DealShare\n',
    catalog: [buildCatalogReadyProvider(DEAL_SHARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DealShare', 'dealshare', 'DealShare']],
  )
})
