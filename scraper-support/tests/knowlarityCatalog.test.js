import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKnowlarityCatalog = async () => {
  try {
    return await import('../../scraper/knowlarity/catalog.js')
  } catch {
    assert.fail('Expected Knowlarity catalog module at ../../scraper/knowlarity/catalog.js')
  }
}

test('Knowlarity catalog captures the verified empty-state first-party careers page metadata', async () => {
  const {
    KNOWLARITY_CATALOG,
    default: defaultCatalog,
  } = await loadKnowlarityCatalog()

  assert.equal(defaultCatalog, KNOWLARITY_CATALOG)
  assert.equal(KNOWLARITY_CATALOG.source, 'knowlarity')
  assert.equal(KNOWLARITY_CATALOG.companyName, 'Knowlarity')
  assert.equal(KNOWLARITY_CATALOG.officialBrandName, 'Knowlarity')
  assert.equal(KNOWLARITY_CATALOG.adapter, 'script')
  assert.equal(KNOWLARITY_CATALOG.companyCareerPage, 'https://www.knowlarity.com/careers')
  assert.equal(KNOWLARITY_CATALOG.homepageUrl, 'https://www.knowlarity.com/')
  assert.equal(KNOWLARITY_CATALOG.companyDomain, 'knowlarity.com')
  assert.equal(KNOWLARITY_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(KNOWLARITY_CATALOG.countryFilter, 'India')
  assert.equal(
    KNOWLARITY_CATALOG.paginationStrategy,
    'verified-first-party-careers-empty-state',
  )
  assert.equal(
    KNOWLARITY_CATALOG.extractionStrategy,
    'verified-careers-page+embedded-next-data-empty-jobOpening-array+empty-state-email-resume-cta',
  )
  assert.equal(KNOWLARITY_CATALOG.parser, 'custom-script')
  assert.equal(KNOWLARITY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KNOWLARITY_CATALOG.dryRunFile, 'knowlarity/jobs.json')
  assert.equal(KNOWLARITY_CATALOG.verifiedOn, '2026-08-15')
  assert.match(KNOWLARITY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.knowlarity\.com\/careers/i)
  assert.match(KNOWLARITY_CATALOG.verifiedSurfaceSummary, /jobOpening:\s*\[\]/i)
  assert.match(KNOWLARITY_CATALOG.verifiedSurfaceSummary, /EMAIL US YOUR RESUME/i)
  assert.match(KNOWLARITY_CATALOG.verifiedSurfaceSummary, /certificate verification/i)
  assert.match(KNOWLARITY_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.match(KNOWLARITY_CATALOG.modulePath, /knowlarity[\\/]script\.js$/i)
})

test('Knowlarity backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KNOWLARITY_CATALOG } = await loadKnowlarityCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Knowlarity\n',
    catalog: [KNOWLARITY_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Knowlarity', 'knowlarity', 'Knowlarity']],
  )
})
