import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/gameskraft/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gameskraft/catalog.js')
  } catch {
    assert.fail('Expected GamesKraft catalog module at ../../scraper/gameskraft/catalog.js')
  }
}

test('GamesKraft catalog captures the verified parked first-party no-public-jobs surface', async () => {
  const {
    GAMESKRAFT_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, GAMESKRAFT_CATALOG)
  assert.equal(GAMESKRAFT_CATALOG.source, 'gameskraft')
  assert.equal(GAMESKRAFT_CATALOG.companyName, 'GamesKraft')
  assert.equal(GAMESKRAFT_CATALOG.adapter, 'script')
  assert.equal(GAMESKRAFT_CATALOG.companyCareerPage, 'https://gameskraft.com/careers')
  assert.equal(GAMESKRAFT_CATALOG.companyDomain, 'gameskraft.com')
  assert.equal(GAMESKRAFT_CATALOG.officialHomepageUrl, 'https://gameskraft.com/')
  assert.equal(GAMESKRAFT_CATALOG.wwwHomepageUrl, 'https://www.gameskraft.com/')
  assert.equal(GAMESKRAFT_CATALOG.landerUrl, 'https://gameskraft.com/lander')
  assert.equal(GAMESKRAFT_CATALOG.robotsTxtUrl, 'https://gameskraft.com/robots.txt')
  assert.equal(GAMESKRAFT_CATALOG.sitemapUrl, 'https://gameskraft.com/sitemap.xml')
  assert.equal(GAMESKRAFT_CATALOG.llmsTxtUrl, 'https://gameskraft.com/llms.txt')
  assert.deepEqual(GAMESKRAFT_CATALOG.noPublicJobRouteUrls, [
    'https://gameskraft.com/jobs',
    'https://gameskraft.com/current-openings',
  ])
  assert.equal(GAMESKRAFT_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GAMESKRAFT_CATALOG.countryFilter, 'India')
  assert.equal(
    GAMESKRAFT_CATALOG.paginationStrategy,
    'verified-redirect-shell-plus-parked-lander-and-crawl-surface-validation',
  )
  assert.equal(
    GAMESKRAFT_CATALOG.extractionStrategy,
    'verified-homepage-and-careers-redirect-shell+verified-parked-lander+sitemap-robots-llms-validation+empty-adjacent-job-routes-return-empty',
  )
  assert.equal(GAMESKRAFT_CATALOG.parser, 'custom-script')
  assert.equal(GAMESKRAFT_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GAMESKRAFT_CATALOG.verifiedOn, '2026-07-15')
  assert.match(GAMESKRAFT_CATALOG.verifiedSurfaceSummary, /https:\/\/gameskraft\.com\//i)
  assert.match(GAMESKRAFT_CATALOG.verifiedSurfaceSummary, /https:\/\/gameskraft\.com\/careers/i)
  assert.match(GAMESKRAFT_CATALOG.verifiedSurfaceSummary, /https:\/\/gameskraft\.com\/lander/i)
  assert.match(GAMESKRAFT_CATALOG.verifiedSurfaceSummary, /https:\/\/gameskraft\.com\/sitemap\.xml/i)
  assert.match(GAMESKRAFT_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(GAMESKRAFT_CATALOG.modulePath, /gameskraft[\\/]script\.js$/i)
  assert.equal(GAMESKRAFT_CATALOG.modulePath, modulePath)
})

test('GamesKraft backlog matching works directly from the local catalog metadata', async () => {
  const { GAMESKRAFT_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'GamesKraft\n',
    catalog: [GAMESKRAFT_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GamesKraft', 'gameskraft', 'GamesKraft']],
  )
})
