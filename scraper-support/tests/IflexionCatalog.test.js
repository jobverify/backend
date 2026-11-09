import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const iflexionModulePath = path.resolve(currentDir, '../../scraper/iflexion/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/iflexion/catalog.js')
  } catch {
    assert.fail('Expected Iflexion catalog module at ../../scraper/iflexion/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/iflexion/script.js')
  } catch {
    assert.fail('Expected Iflexion scraper module at ../../scraper/iflexion/script.js')
  }
}

test('Iflexion local catalog captures the verified no-public-careers sentinel contract', async () => {
  const { IFLEXION_CATALOG } = await loadCatalogModule()
  const iflexion = await loadScriptModule()

  assert.equal(IFLEXION_CATALOG.source, 'iflexion')
  assert.equal(IFLEXION_CATALOG.companyName, 'Iflexion')
  assert.equal(IFLEXION_CATALOG.officialBrandName, 'Iflexion')
  assert.equal(IFLEXION_CATALOG.adapter, 'script')
  assert.equal(IFLEXION_CATALOG.companyCareerPage, 'https://www.iflexion.com/')
  assert.equal(IFLEXION_CATALOG.homepageUrl, 'https://www.iflexion.com/')
  assert.equal(IFLEXION_CATALOG.sitemapUrl, 'https://www.iflexion.com/sitemap.xml')
  assert.deepEqual(IFLEXION_CATALOG.noPublicJobRouteUrls, [
    'https://www.iflexion.com/careers',
    'https://www.iflexion.com/careers/',
    'https://www.iflexion.com/jobs',
    'https://www.iflexion.com/jobs/',
    'https://www.iflexion.com/careers-and-jobs',
  ])
  assert.equal(IFLEXION_CATALOG.companyDomain, 'iflexion.com')
  assert.equal(IFLEXION_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(IFLEXION_CATALOG.countryFilter, 'India')
  assert.equal(
    IFLEXION_CATALOG.paginationStrategy,
    'verified-homepage-plus-sitemap-plus-common-job-route-validation',
  )
  assert.equal(
    IFLEXION_CATALOG.extractionStrategy,
    'verified-first-party-marketing-site+verified-sitemap-without-careers+verified-common-job-routes-return-empty',
  )
  assert.equal(IFLEXION_CATALOG.parser, 'custom-script')
  assert.equal(IFLEXION_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(IFLEXION_CATALOG.dryRunFile, 'iflexion/jobs.json')
  assert.equal(IFLEXION_CATALOG.verifiedOn, '2026-07-16')
  assert.match(IFLEXION_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.iflexion\.com\//i)
  assert.match(IFLEXION_CATALOG.verifiedSurfaceSummary, /sitemap\.xml/i)
  assert.match(IFLEXION_CATALOG.verifiedSurfaceSummary, /404/i)
  assert.match(IFLEXION_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(IFLEXION_CATALOG.modulePath, iflexionModulePath)

  assert.equal(iflexion.PROVIDER_METADATA.source, IFLEXION_CATALOG.source)
  assert.equal(iflexion.PROVIDER_METADATA.companyCareerPage, IFLEXION_CATALOG.companyCareerPage)
})

test('Iflexion exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { IFLEXION_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Iflexion\n',
    catalog: [IFLEXION_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Iflexion', 'iflexion', 'Iflexion']],
  )
})

test('getScraperCatalog includes Iflexion as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'iflexion')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Iflexion')
  assert.equal(provider.companyCareerPage, 'https://www.iflexion.com/')
  assert.equal(provider.companyDomain, 'iflexion.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /iflexion[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Iflexion scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'iflexion')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'iflexion')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /iflexion[\\/]jobs\.json$/i)
})
