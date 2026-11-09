import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/anthem/catalog.js')
  } catch {
    assert.fail('Expected Anthem catalog module at ../../scraper/anthem/catalog.js')
  }
}

test('Anthem local catalog captures the verified first-party careers page and public PeopleStrong handoff without aliases', async () => {
  const { ANTHEM_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ANTHEM_CATALOG)

  assert.equal(provider.source, 'anthem')
  assert.equal(provider.companyName, 'Anthem')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://anthembio.com/careers/')
  assert.equal(provider.homepageUrl, 'https://anthembio.com/')
  assert.equal(provider.robotsTxtUrl, 'https://anthembio.com/robots.txt')
  assert.equal(provider.sitemapIndexUrl, 'https://anthembio.com/sitemap.xml')
  assert.equal(provider.pageSitemapUrl, 'https://anthembio.com/page-sitemap.xml')
  assert.equal(provider.portalOrigin, 'https://anthemhrcp.peoplestrong.com')
  assert.equal(provider.jobListingsUrl, 'https://anthemhrcp.peoplestrong.com/')
  assert.equal(
    provider.jobsApiUrl,
    'https://anthemhrcp.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(provider.companyDomain, 'anthembio.com')
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-homepage-plus-first-party-careers-page-plus-offset-limit-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'official-homepage+official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.modulePath, /anthem[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anthembio\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/anthemhrcp\.peoplestrong\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/anthemhrcp\.peoplestrong\.com\/api\/cp\/rest\/altone\/cp\/jobs\/v1\?offset=0&limit=20/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Open Positions \(5\)/i)
  assert.match(provider.verifiedSurfaceSummary, /0 public records|totalRecords[: ]+0/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Anthem'), false)
})

test('Anthem backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { ANTHEM_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Anthem\n',
    catalog: [hydrateProviderCatalogEntry(ANTHEM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anthem', 'anthem', 'Anthem']],
  )
})

test('buildScrapers and company coverage resolve Anthem from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'anthem')
  const scraper = buildScrapers().find((item) => item.name === 'anthem')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Anthem')
  assert.equal(provider.companyCareerPage, 'https://anthembio.com/careers/')
  assert.match(scraper.dryRunFile, /anthem[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Anthem\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Anthem', 'anthem', 'Anthem']],
  )
})
