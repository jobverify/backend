import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const insideviewModulePath = path.resolve(currentDir, '../../scraper/insideview/script.js')

const loadInsideViewCatalog = async () => {
  try {
    return await import('../../scraper/insideview/catalog.js')
  } catch {
    assert.fail('Expected InsideView catalog module at ../../scraper/insideview/catalog.js')
  }
}

const loadInsideViewModule = async () => {
  try {
    return await import('../../scraper/insideview/script.js')
  } catch {
    assert.fail('Expected InsideView scraper module at ../../scraper/insideview/script.js')
  }
}

test('InsideView local catalog captures the verified legacy-brand redirect and exact-name login sentinel state', async () => {
  const { INSIDEVIEW_CATALOG } = await loadInsideViewCatalog()
  const insideview = await loadInsideViewModule()
  const provider = hydrateProviderCatalogEntry(INSIDEVIEW_CATALOG)

  assert.equal(provider.source, 'insideview')
  assert.equal(provider.companyName, 'InsideView')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.insideview.com/')
  assert.equal(provider.redirectedHomepageUrl, 'https://www.demandbase.com/')
  assert.equal(provider.legacyLoginUrl, 'https://my.insideview.com/iv/login/forgot_password.jsp')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-legacy-brand-root-redirect-plus-legacy-login-surface-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-insideview-root-redirect-to-demandbase+verified-legacy-login-surface-without-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'insideview.com')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.modulePath, /insideview[\\/]script\.js$/i)
  assert.equal(provider.modulePath, insideviewModulePath)
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.insideview\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.demandbase\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/my\.insideview\.com\/iv\/login\/forgot_password\.jsp/i)
  assert.match(provider.verifiedSurfaceSummary, /set-password \/ forgot-password account surface/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(insideview.PROVIDER_METADATA.source, INSIDEVIEW_CATALOG.source)
  assert.equal(insideview.PROVIDER_METADATA.companyName, INSIDEVIEW_CATALOG.companyName)
  assert.equal(
    insideview.PROVIDER_METADATA.redirectedHomepageUrl,
    INSIDEVIEW_CATALOG.redirectedHomepageUrl,
  )
})

test('InsideView backlog row matches directly from local provider metadata without alias churn', async () => {
  const { INSIDEVIEW_CATALOG } = await loadInsideViewCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'InsideView\n',
    catalog: [hydrateProviderCatalogEntry(INSIDEVIEW_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['InsideView', 'insideview', 'InsideView']],
  )
})

test('getScraperCatalog includes InsideView as a verified exact-name sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'insideview')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'InsideView')
  assert.equal(provider.companyCareerPage, 'https://www.insideview.com/')
  assert.equal(provider.companyDomain, 'insideview.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /insideview[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable InsideView scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'insideview')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'insideview')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /insideview[\\/]jobs\.json$/i)
})
