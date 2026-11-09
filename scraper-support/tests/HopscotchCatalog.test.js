import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const hopscotchModulePath = path.resolve(currentDir, '../../scraper/hopscotch/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hopscotch/catalog.js')
  } catch {
    assert.fail('Expected Hopscotch catalog module at ../../scraper/hopscotch/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hopscotch/script.js')
  } catch {
    assert.fail('Expected Hopscotch scraper module at ../../scraper/hopscotch/script.js')
  }
}

test('Hopscotch local catalog captures the verified no-public-jobs sentinel contract', async () => {
  const { HOPSCOTCH_CATALOG } = await loadCatalogModule()
  const hopscotch = await loadScriptModule()

  assert.equal(HOPSCOTCH_CATALOG.source, 'hopscotch')
  assert.equal(HOPSCOTCH_CATALOG.companyName, 'Hopscotch')
  assert.equal(HOPSCOTCH_CATALOG.officialBrandName, 'Hopscotch')
  assert.equal(HOPSCOTCH_CATALOG.adapter, 'script')
  assert.equal(HOPSCOTCH_CATALOG.companyCareerPage, 'https://www.hopscotch.in/')
  assert.equal(HOPSCOTCH_CATALOG.homepageUrl, 'https://www.hopscotch.in/')
  assert.equal(HOPSCOTCH_CATALOG.sitemapUrl, 'https://www.hopscotch.in/sitemap.xml')
  assert.deepEqual(HOPSCOTCH_CATALOG.noPublicJobRouteUrls, [
    'https://www.hopscotch.in/careers',
    'https://www.hopscotch.in/jobs',
    'https://www.hopscotch.in/job-openings',
  ])
  assert.equal(HOPSCOTCH_CATALOG.companyDomain, 'hopscotch.in')
  assert.equal(HOPSCOTCH_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(HOPSCOTCH_CATALOG.countryFilter, 'India')
  assert.equal(
    HOPSCOTCH_CATALOG.paginationStrategy,
    'verified-app-shell-plus-sitemap-and-common-job-route-validation',
  )
  assert.equal(
    HOPSCOTCH_CATALOG.extractionStrategy,
    'verified-first-party-commerce-shell+verified-sitemap-without-careers+verified-common-job-routes-without-public-listings-return-empty',
  )
  assert.equal(HOPSCOTCH_CATALOG.parser, 'custom-script')
  assert.equal(HOPSCOTCH_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(HOPSCOTCH_CATALOG.dryRunFile, 'hopscotch/jobs.json')
  assert.equal(HOPSCOTCH_CATALOG.verifiedOn, '2026-07-16')
  assert.match(HOPSCOTCH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.hopscotch\.in\//i)
  assert.match(HOPSCOTCH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.hopscotch\.in\/sitemap\.xml/i)
  assert.match(HOPSCOTCH_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(HOPSCOTCH_CATALOG.modulePath, hopscotchModulePath)

  assert.equal(hopscotch.PROVIDER_METADATA.source, HOPSCOTCH_CATALOG.source)
  assert.equal(hopscotch.PROVIDER_METADATA.companyCareerPage, HOPSCOTCH_CATALOG.companyCareerPage)
})

test('Hopscotch exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { HOPSCOTCH_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Hopscotch\n',
    catalog: [HOPSCOTCH_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hopscotch', 'hopscotch', 'Hopscotch']],
  )
})

test('getScraperCatalog includes Hopscotch as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hopscotch')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hopscotch')
  assert.equal(provider.companyCareerPage, 'https://www.hopscotch.in/')
  assert.equal(provider.companyDomain, 'hopscotch.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /hopscotch[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hopscotch scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hopscotch')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hopscotch')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /hopscotch[\\/]jobs\.json$/i)
})
