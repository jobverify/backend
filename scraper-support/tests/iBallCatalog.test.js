import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const iBallModulePath = path.resolve(currentDir, '../../scraper/iball/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/iball/catalog.js')
  } catch {
    assert.fail('Expected iBall catalog module at ../../scraper/iball/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/iball/script.js')
  } catch {
    assert.fail('Expected iBall scraper module at ../../scraper/iball/script.js')
  }
}

test('iBall local catalog captures the verified no-public-jobs first-party surface without aliases', async () => {
  const { IBALL_CATALOG } = await loadCatalogModule()
  const iBall = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(IBALL_CATALOG)

  assert.equal(provider.source, 'iball')
  assert.equal(provider.companyName, 'iBall')
  assert.equal(provider.officialBrandName, 'iBall')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://iball.co.in/')
  assert.equal(provider.officialHomepageUrl, 'https://iball.co.in/')
  assert.equal(provider.officialAboutUrl, 'https://iball.co.in/pages/about-us')
  assert.equal(provider.officialNewsCenterUrl, 'https://iball.co.in/blogs/news-center')
  assert.deepEqual(provider.commonCareerRoutes, [
    'https://iball.co.in/pages/careers',
    'https://iball.co.in/pages/career',
    'https://iball.co.in/careers',
    'https://iball.co.in/jobs',
    'https://iball.co.in/join-us',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-about-plus-news-center-plus-common-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-brand-homepage+verified-about-page+verified-news-center+verified-missing-or-non-job-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'iball.co.in')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /iball[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/iball\.co\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/iball\.co\.in\/pages\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/iball\.co\.in\/blogs\/news-center/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, iBallModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iBall'), false)

  assert.equal(iBall.PROVIDER_METADATA.source, IBALL_CATALOG.source)
  assert.equal(iBall.PROVIDER_METADATA.companyName, IBALL_CATALOG.companyName)
  assert.deepEqual(iBall.PROVIDER_METADATA.commonCareerRoutes, IBALL_CATALOG.commonCareerRoutes)
})

test('iBall backlog row matches directly from the local catalog without alias changes', async () => {
  const { IBALL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'iBall\n',
    catalog: [hydrateProviderCatalogEntry(IBALL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iBall', 'iball', 'iBall']],
  )
})

test('getScraperCatalog includes iBall as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iball')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iBall')
  assert.equal(provider.companyCareerPage, 'https://iball.co.in/')
  assert.equal(provider.companyDomain, 'iball.co.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /iball[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable iBall scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iball')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iball')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /iball[\\/]jobs\.json$/i)
})
