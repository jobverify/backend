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
const pluto7ModulePath = path.resolve(currentDir, '../../scraper/pluto7/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pluto7/catalog.js')
  } catch {
    assert.fail('Expected Pluto7 catalog module at ../../scraper/pluto7/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pluto7/script.js')
  } catch {
    assert.fail('Expected Pluto7 scraper module at ../../scraper/pluto7/script.js')
  }
}

test('Pluto7 local catalog captures the verified first-party careers flow into the public Freshteam board without alias churn', async () => {
  const { PLUTO7_CATALOG } = await loadCatalogModule()
  const pluto7 = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PLUTO7_CATALOG)

  assert.equal(provider.source, 'pluto7')
  assert.equal(provider.companyName, 'Pluto7')
  assert.equal(provider.officialBrandName, 'Pluto7')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://pluto7.com/')
  assert.equal(provider.companyCareerPage, 'https://pluto7.com/career-openings/')
  assert.equal(provider.officialCareersPageUrl, 'https://pluto7.com/careers/')
  assert.equal(
    provider.freshteamWidgetScriptUrl,
    'https://s3.amazonaws.com/files.freshteam.com/production/30755/attachments/2000860557/original/2000015632_widget.js?1579600329',
  )
  assert.equal(provider.officialJobsBoardUrl, 'https://pluto7.freshteam.com/jobs')
  assert.equal(provider.listingSearchUrl, 'https://pluto7.freshteam.com/jobs/search')
  assert.equal(
    provider.detailUrlPattern,
    'https://pluto7.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-careers-page-plus-career-openings-freshteam-widget',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+freshteam-widget+public-freshteam-search+detail-page-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pluto7.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /pluto7[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, pluto7ModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pluto7\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pluto7\.com\/career-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pluto7\.freshteam\.com\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud DevOps and Security Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pluto7'), false)

  assert.equal(pluto7.PROVIDER_METADATA.source, PLUTO7_CATALOG.source)
  assert.equal(pluto7.PROVIDER_METADATA.companyName, PLUTO7_CATALOG.companyName)
  assert.equal(pluto7.PROVIDER_METADATA.listingSearchUrl, PLUTO7_CATALOG.listingSearchUrl)
})

test('Pluto7 backlog row matches directly from the local catalog without alias churn', async () => {
  const { PLUTO7_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Pluto7\n',
    catalog: [hydrateProviderCatalogEntry(PLUTO7_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pluto7', 'pluto7', 'Pluto7']],
  )
})

test('getScraperCatalog exposes Pluto7 as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pluto7')
  const scraper = buildScrapers().find((item) => item.name === 'pluto7')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Pluto7')
  assert.equal(provider.companyCareerPage, 'https://pluto7.com/career-openings/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pluto7'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Pluto7\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pluto7', 'pluto7', 'Pluto7']],
  )
})
