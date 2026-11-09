import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKrutrimCatalog = async () => {
  try {
    return await import('../../scraper/krutrim/catalog.js')
  } catch {
    assert.fail('Expected Krutrim catalog module at ../../scraper/krutrim/catalog.js')
  }
}

test('Krutrim catalog captures the verified no-public-jobs first-party surfaces', async () => {
  const {
    KRUTRIM_CATALOG,
    default: defaultCatalog,
  } = await loadKrutrimCatalog()

  assert.equal(defaultCatalog, KRUTRIM_CATALOG)
  assert.equal(KRUTRIM_CATALOG.source, 'krutrim')
  assert.equal(KRUTRIM_CATALOG.companyName, 'Krutrim')
  assert.equal(KRUTRIM_CATALOG.officialBrandName, 'Krutrim')
  assert.equal(KRUTRIM_CATALOG.adapter, 'script')
  assert.equal(KRUTRIM_CATALOG.companyCareerPage, 'https://ai-labs.olakrutrim.com/')
  assert.equal(KRUTRIM_CATALOG.homepageUrl, 'https://www.olakrutrim.com/')
  assert.equal(KRUTRIM_CATALOG.companyDomain, 'olakrutrim.com')
  assert.equal(KRUTRIM_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KRUTRIM_CATALOG.countryFilter, 'India')
  assert.equal(
    KRUTRIM_CATALOG.paginationStrategy,
    'homepage-plus-ai-labs-join-us-shell-plus-missing-crawlable-careers-routes',
  )
  assert.equal(
    KRUTRIM_CATALOG.extractionStrategy,
    'verified-main-homepage+verified-ai-labs-join-us-shell+verified-no-crawlable-job-links+missing-careers-routes-and-sitemap-surface-return-empty',
  )
  assert.equal(KRUTRIM_CATALOG.parser, 'custom-script')
  assert.equal(KRUTRIM_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KRUTRIM_CATALOG.dryRunFile, 'krutrim/jobs.json')
  assert.equal(KRUTRIM_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KRUTRIM_CATALOG.verifiedSurfaceSummary, /https:\/\/ai-labs\.olakrutrim\.com\//i)
  assert.match(KRUTRIM_CATALOG.verifiedSurfaceSummary, /Open Positions/i)
  assert.match(KRUTRIM_CATALOG.verifiedSurfaceSummary, /sitemap\.xml/i)
  assert.match(KRUTRIM_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(KRUTRIM_CATALOG.modulePath, /krutrim[\\/]script\.js$/i)
})

test('Krutrim backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KRUTRIM_CATALOG } = await loadKrutrimCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Krutrim\n',
    catalog: [KRUTRIM_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Krutrim', 'krutrim', 'Krutrim']],
  )
})
