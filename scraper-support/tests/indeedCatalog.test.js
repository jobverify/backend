import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/indeed/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indeed/catalog.js')
  } catch {
    assert.fail('Expected Indeed catalog module at ../../scraper/indeed/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/indeed/script.js')
  } catch {
    assert.fail('Expected Indeed scraper module at ../../scraper/indeed/script.js')
  }
}

test('Indeed local catalog captures the verified official careers handoff, India jobs board, and challenge-aware parser contract', async () => {
  const { INDEED_CATALOG } = await loadCatalogModule()
  const indeed = await loadScriptModule()

  assert.equal(INDEED_CATALOG.source, 'indeed')
  assert.equal(INDEED_CATALOG.companyName, 'Indeed')
  assert.equal(INDEED_CATALOG.officialBrandName, 'Indeed')
  assert.equal(INDEED_CATALOG.adapter, 'script')
  assert.equal(INDEED_CATALOG.companyCareerPage, 'https://www.indeed.com/careers')
  assert.equal(INDEED_CATALOG.indiaCareersPage, 'https://in.indeed.com/careers')
  assert.equal(INDEED_CATALOG.indiaJobsPage, 'https://in.indeed.com/cmp/Indeed/jobs')
  assert.equal(INDEED_CATALOG.companyDomain, 'indeed.com')
  assert.equal(INDEED_CATALOG.atsPlatform, 'indeed-first-party-company-jobs')
  assert.equal(INDEED_CATALOG.countryFilter, 'India')
  assert.equal(
    INDEED_CATALOG.paginationStrategy,
    'verified-global-careers-page-plus-india-company-jobs-page',
  )
  assert.equal(
    INDEED_CATALOG.extractionStrategy,
    'verified-global-careers-page+verified-india-company-jobs-page+public-listings-html+cloudflare-fail-closed',
  )
  assert.equal(INDEED_CATALOG.parser, 'custom-script')
  assert.equal(INDEED_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDEED_CATALOG.verifiedOn, '2026-08-02')
  assert.match(INDEED_CATALOG.verifiedSurfaceSummary, /just a moment/i)
  assert.match(INDEED_CATALOG.verifiedSurfaceSummary, /additional verification required/i)
  assert.match(INDEED_CATALOG.verifiedSurfaceSummary, /returns no jobs until the listings become publicly reachable again/i)
  assert.equal(INDEED_CATALOG.modulePath, modulePath)
  assert.match(INDEED_CATALOG.dryRunFile, /indeed[\\/]jobs\.json$/i)

  assert.equal(indeed.PROVIDER_METADATA.source, INDEED_CATALOG.source)
  assert.equal(indeed.PROVIDER_METADATA.companyCareerPage, INDEED_CATALOG.companyCareerPage)
  assert.equal(indeed.PROVIDER_METADATA.indiaJobsPage, INDEED_CATALOG.indiaJobsPage)
})

test('Indeed exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { INDEED_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Indeed\n',
    catalog: [INDEED_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Indeed', 'indeed', 'Indeed']],
  )
})

test('getScraperCatalog includes Indeed as a verified first-party company jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indeed')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Indeed')
  assert.equal(provider.companyCareerPage, 'https://www.indeed.com/careers')
  assert.equal(provider.companyDomain, 'indeed.com')
  assert.equal(provider.atsPlatform, 'indeed-first-party-company-jobs')
  assert.match(provider.modulePath, /indeed[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Indeed scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indeed')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indeed')
  assert.equal(scraper.provider.atsPlatform, 'indeed-first-party-company-jobs')
  assert.match(scraper.dryRunFile, /indeed[\\/]jobs\.json$/i)
})
