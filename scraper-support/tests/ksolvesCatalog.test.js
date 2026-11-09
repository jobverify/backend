import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadKsolvesCatalog = async () => {
  try {
    return await import('../../scraper/ksolves/catalog.js')
  } catch {
    assert.fail('Expected Ksolves catalog module at ../../scraper/ksolves/catalog.js')
  }
}

test('Ksolves catalog captures the verified official careers index and first-party detail pages', async () => {
  const {
    KSOLVES_CATALOG,
    default: defaultCatalog,
  } = await loadKsolvesCatalog()

  assert.equal(defaultCatalog, KSOLVES_CATALOG)
  assert.equal(KSOLVES_CATALOG.source, 'ksolves')
  assert.equal(KSOLVES_CATALOG.companyName, 'Ksolves')
  assert.equal(KSOLVES_CATALOG.officialBrandName, 'Ksolves')
  assert.equal(KSOLVES_CATALOG.adapter, 'script')
  assert.equal(KSOLVES_CATALOG.companyCareerPage, 'https://www.ksolves.com/careers')
  assert.equal(KSOLVES_CATALOG.homepageUrl, 'https://www.ksolves.com/')
  assert.deepEqual(KSOLVES_CATALOG.verifiedRoleUrls, [
    'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
    'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
  ])
  assert.equal(KSOLVES_CATALOG.companyDomain, 'ksolves.com')
  assert.equal(KSOLVES_CATALOG.atsPlatform, 'official-company-site')
  assert.equal(KSOLVES_CATALOG.countryFilter, 'India')
  assert.equal(
    KSOLVES_CATALOG.paginationStrategy,
    'single-first-party-openings-page-plus-first-party-detail-pages',
  )
  assert.equal(
    KSOLVES_CATALOG.extractionStrategy,
    'verified-careers-page+listing-cards-with-data-location-and-jobtype+detail-pages-with-job-meta-and-inline-apply-form',
  )
  assert.equal(KSOLVES_CATALOG.parser, 'custom-script')
  assert.equal(KSOLVES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KSOLVES_CATALOG.dryRunFile, 'ksolves/jobs.json')
  assert.equal(KSOLVES_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KSOLVES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ksolves\.com\/careers/i)
  assert.match(KSOLVES_CATALOG.verifiedSurfaceSummary, /Full Stack Developer/i)
  assert.match(KSOLVES_CATALOG.verifiedSurfaceSummary, /Senior Software Engineer \(Data\)/i)
  assert.match(KSOLVES_CATALOG.modulePath, /ksolves[\\/]script\.js$/i)
})

test('Ksolves backlog matching works directly from the local catalog metadata without aliases', async () => {
  const { KSOLVES_CATALOG } = await loadKsolvesCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Ksolves\n',
    catalog: [KSOLVES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ksolves', 'ksolves', 'Ksolves']],
  )
})
