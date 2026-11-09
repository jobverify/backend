import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jcbindia/catalog.js')
  } catch {
    assert.fail('Expected JCB India catalog module at ../../scraper/jcbindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/jcbindia/script.js')
  } catch {
    assert.fail('Expected JCB India scraper module at ../../scraper/jcbindia/script.js')
  }
}

test('JCB India local catalog captures the verified first-party search board contract', async () => {
  const { JCB_INDIA_CATALOG } = await loadCatalogModule()
  const jcbIndia = await loadScraperModule()

  assert.equal(JCB_INDIA_CATALOG.source, 'jcbindia')
  assert.equal(JCB_INDIA_CATALOG.companyName, 'JCB India')
  assert.equal(JCB_INDIA_CATALOG.officialBrandName, 'JCB India')
  assert.equal(JCB_INDIA_CATALOG.adapter, 'script')
  assert.equal(JCB_INDIA_CATALOG.modulePath, '../../scraper/jcbindia/script.js')
  assert.equal(
    JCB_INDIA_CATALOG.companyCareerPage,
    'https://www.jcb.com/en-IN/explore/engage/careers/',
  )
  assert.equal(
    JCB_INDIA_CATALOG.officialCareersPageUrl,
    'https://www.jcb.com/en-IN/explore/engage/careers/',
  )
  assert.equal(JCB_INDIA_CATALOG.officialJobsBoardUrl, 'https://career-in.jcb.com/')
  assert.equal(JCB_INDIA_CATALOG.accessibleSearchUrl, 'https://career-in.jcb.com/search/')
  assert.equal(
    JCB_INDIA_CATALOG.detailUrlPattern,
    'https://career-in.jcb.com/job/{slug}/{jobId}/',
  )
  assert.equal(JCB_INDIA_CATALOG.companyDomain, 'jcb.com')
  assert.equal(JCB_INDIA_CATALOG.atsPlatform, 'official-company-jobs-board')
  assert.equal(JCB_INDIA_CATALOG.countryFilter, 'India')
  assert.equal(
    JCB_INDIA_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-accessible-search-results-pagination',
  )
  assert.equal(
    JCB_INDIA_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+accessible-search-results+detail-pages',
  )
  assert.equal(JCB_INDIA_CATALOG.parser, 'custom-script')
  assert.equal(JCB_INDIA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JCB_INDIA_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(JCB_INDIA_CATALOG.dryRunFile, 'jcbindia/jobs.json')
  assert.match(JCB_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.jcb\.com\/en-IN\/explore\/engage\/careers\//i)
  assert.match(JCB_INDIA_CATALOG.verifiedSurfaceSummary, /https:\/\/career-in\.jcb\.com\/search\//i)
  assert.match(JCB_INDIA_CATALOG.verifiedSurfaceSummary, /Engineer/i)
  assert.match(JCB_INDIA_CATALOG.verifiedSurfaceSummary, /Assistant Manager/i)

  assert.equal(jcbIndia.PROVIDER_METADATA.source, JCB_INDIA_CATALOG.source)
  assert.equal(
    jcbIndia.PROVIDER_METADATA.accessibleSearchUrl,
    JCB_INDIA_CATALOG.accessibleSearchUrl,
  )
})

test('JCB India exact backlog row matches directly from the local catalog without aliases', async () => {
  const { JCB_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'JCB India\n',
    catalog: [JCB_INDIA_CATALOG],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['JCB India', 'jcbindia', 'JCB India']],
  )
})

test('getScraperCatalog includes JCB India as a verified first-party jobs-board provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jcbindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'JCB India')
  assert.equal(provider.companyCareerPage, 'https://www.jcb.com/en-IN/explore/engage/careers/')
  assert.equal(provider.companyDomain, 'jcb.com')
  assert.equal(provider.atsPlatform, 'official-company-jobs-board')
  assert.match(provider.modulePath, /jcbindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable JCB India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jcbindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jcbindia')
  assert.equal(scraper.provider.atsPlatform, 'official-company-jobs-board')
  assert.match(scraper.dryRunFile, /jcbindia[\\/]jobs\.json$/i)
})
