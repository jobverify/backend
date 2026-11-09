import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/funplus/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/funplus/catalog.js')
  } catch {
    assert.fail('Expected FunPlus catalog module at ../../scraper/funplus/catalog.js')
  }
}

test('FunPlus local catalog captures the verified first-party careers iframe and public Factorial jobs surface', async () => {
  const { FUNPLUS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FUNPLUS_CATALOG)

  assert.equal(provider.source, 'funplus')
  assert.equal(provider.companyName, 'FunPlus')
  assert.equal(provider.officialBrandName, 'FunPlus')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://funplus.com/')
  assert.equal(provider.companyCareerPage, 'https://funplus.com/careers/')
  assert.equal(provider.jobsBoardUrl, 'https://funplus.factorialhr.com/embed/jobs')
  assert.equal(provider.jobsSitemapUrl, 'https://funplus.factorialhr.com/sitemap.xml')
  assert.equal(
    provider.sampleDetailUrl,
    'https://funplus.factorialhr.com/embed/job_posting/community-manager-intern-298342',
  )
  assert.equal(
    provider.sampleApplyUrl,
    'https://funplus.factorialhr.com/embed/apply/community-manager-intern-298342',
  )
  assert.equal(provider.companyDomain, 'funplus.com')
  assert.equal(provider.atsPlatform, 'factorialhr-embed-jobs-html')
  assert.equal(provider.paginationStrategy, 'single-verified-public-factorial-embed-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-iframe+factorial-board-html+detail-pages+sitemap-lastmod',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /funplus[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/funplus\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/funplus\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/funplus\.factorialhr\.com\/embed\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/funplus\.factorialhr\.com\/sitemap\.xml/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/funplus\.factorialhr\.com\/embed\/job_posting\/community-manager-intern-298342/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/funplus\.factorialhr\.com\/embed\/job_posting\/senior-brand-manager-gaming-310659/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b2 public Factorial roles\b/i)
})

test('FunPlus exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { FUNPLUS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'FunPlus\n',
    catalog: [hydrateProviderCatalogEntry(FUNPLUS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FunPlus', 'funplus', 'FunPlus']],
  )
})
