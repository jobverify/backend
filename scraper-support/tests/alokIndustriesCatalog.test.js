import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadAlokIndustriesCatalog = async () => {
  try {
    return await import('../../scraper/alokindustries/catalog.js')
  } catch {
    assert.fail('Expected Alok Industries catalog module at ../../scraper/alokindustries/catalog.js')
  }
}

test('Alok Industries catalog captures the verified resume-only first-party careers surface', async () => {
  const {
    ALOK_INDUSTRIES_CATALOG,
    default: defaultCatalog,
  } = await loadAlokIndustriesCatalog()

  assert.equal(defaultCatalog, ALOK_INDUSTRIES_CATALOG)
  assert.equal(ALOK_INDUSTRIES_CATALOG.source, 'alokindustries')
  assert.equal(ALOK_INDUSTRIES_CATALOG.companyName, 'Alok Industries')
  assert.equal(ALOK_INDUSTRIES_CATALOG.legalEntityName, 'Alok Industries Limited')
  assert.equal(ALOK_INDUSTRIES_CATALOG.adapter, 'script')
  assert.equal(ALOK_INDUSTRIES_CATALOG.companyCareerPage, 'https://www.alokind.com/careers.html')
  assert.equal(ALOK_INDUSTRIES_CATALOG.companyDomain, 'alokind.com')
  assert.equal(ALOK_INDUSTRIES_CATALOG.officialHomepageUrl, 'https://www.alokind.com/')
  assert.equal(ALOK_INDUSTRIES_CATALOG.robotsTxtUrl, 'https://www.alokind.com/robots.txt')
  assert.equal(ALOK_INDUSTRIES_CATALOG.sitemapUrl, 'https://www.alokind.com/sitemap.xml')
  assert.equal(ALOK_INDUSTRIES_CATALOG.officialResumeEmail, 'resume@alokind.com')
  assert.equal(ALOK_INDUSTRIES_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(ALOK_INDUSTRIES_CATALOG.countryFilter, 'India')
  assert.equal(
    ALOK_INDUSTRIES_CATALOG.paginationStrategy,
    'verified-homepage-plus-resume-only-careers-page-plus-missing-first-party-job-routes',
  )
  assert.equal(
    ALOK_INDUSTRIES_CATALOG.extractionStrategy,
    'verified-homepage-careers-link+verified-resume-only-careers-page+verified-missing-first-party-job-routes-return-empty',
  )
  assert.equal(ALOK_INDUSTRIES_CATALOG.parser, 'custom-script')
  assert.equal(ALOK_INDUSTRIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ALOK_INDUSTRIES_CATALOG.verifiedOn, '2026-07-15')
  assert.match(ALOK_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.alokind\.com\//i)
  assert.match(
    ALOK_INDUSTRIES_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.alokind\.com\/careers\.html/i,
  )
  assert.match(ALOK_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /resume@alokind\.com/i)
  assert.match(ALOK_INDUSTRIES_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(ALOK_INDUSTRIES_CATALOG.modulePath, /alokindustries[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Alok Industries'), false)
})

test('Alok Industries backlog matching works directly from the local catalog metadata', async () => {
  const { ALOK_INDUSTRIES_CATALOG } = await loadAlokIndustriesCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Alok Industries\n',
    catalog: [ALOK_INDUSTRIES_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alok Industries', 'alokindustries', 'Alok Industries']],
  )
})

test('buildScrapers and company coverage resolve Alok Industries from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'alokindustries')
  const scraper = buildScrapers().find((item) => item.name === 'alokindustries')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Alok Industries')
  assert.equal(provider.companyCareerPage, 'https://www.alokind.com/careers.html')
  assert.match(scraper.dryRunFile, /alokindustries[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Alok Industries\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Alok Industries', 'alokindustries', 'Alok Industries']],
  )
})
