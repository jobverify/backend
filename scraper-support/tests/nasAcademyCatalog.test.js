import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nasacademy/catalog.js')
  } catch {
    assert.fail('Expected Nas Academy catalog module at ../../scraper/nasacademy/catalog.js')
  }
}

test('Nas Academy catalog captures the verified no-trustworthy-exact-name-jobs contract', async () => {
  const {
    NAS_ACADEMY_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, NAS_ACADEMY_CATALOG)
  assert.equal(NAS_ACADEMY_CATALOG.source, 'nasacademy')
  assert.equal(NAS_ACADEMY_CATALOG.companyName, 'Nas Academy')
  assert.equal(NAS_ACADEMY_CATALOG.officialBrandName, 'Nas Academy')
  assert.equal(NAS_ACADEMY_CATALOG.adapter, 'script')
  assert.equal(NAS_ACADEMY_CATALOG.companyCareerPage, 'https://www.nas.co/work-with-us')
  assert.equal(NAS_ACADEMY_CATALOG.homepageUrl, 'https://nasacademy.com/')
  assert.equal(NAS_ACADEMY_CATALOG.officialCareersHandoffUrl, 'https://linktr.ee/nascompany')
  assert.equal(NAS_ACADEMY_CATALOG.companyDomain, 'nasacademy.com')
  assert.equal(
    NAS_ACADEMY_CATALOG.atsPlatform,
    'official-company-page-company-level-linktree-no-exact-nasacademy-board',
  )
  assert.equal(NAS_ACADEMY_CATALOG.countryFilter, 'Global')
  assert.equal(
    NAS_ACADEMY_CATALOG.paginationStrategy,
    'verified-page-plus-company-level-linktree-handoff',
  )
  assert.equal(
    NAS_ACADEMY_CATALOG.extractionStrategy,
    'official-nas-careers-page+company-level-linktree-links+no-exact-nas-academy-jobs-link',
  )
  assert.equal(NAS_ACADEMY_CATALOG.parser, 'custom-script')
  assert.equal(NAS_ACADEMY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(NAS_ACADEMY_CATALOG.dryRunFile, 'nasacademy/jobs.json')
  assert.equal(NAS_ACADEMY_CATALOG.verifiedOn, '2026-08-03')
  assert.match(NAS_ACADEMY_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.nas\.co\/work-with-us/i)
  assert.match(NAS_ACADEMY_CATALOG.verifiedSurfaceSummary, /https:\/\/linktr\.ee\/nascompany/i)
  assert.match(NAS_ACADEMY_CATALOG.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(NAS_ACADEMY_CATALOG.verifiedSurfaceSummary, /nested button markup/i)
  assert.match(NAS_ACADEMY_CATALOG.verifiedSurfaceSummary, /no trustworthy exact-name Nas Academy public jobs surface/i)
  assert.match(NAS_ACADEMY_CATALOG.modulePath, /nasacademy[\\/]script\.js$/i)
})

test('Nas Academy exact backlog row resolves directly from the local sentinel metadata', async () => {
  const { NAS_ACADEMY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Nas Academy\n',
    catalog: [NAS_ACADEMY_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nas Academy', 'nasacademy', 'Nas Academy']],
  )
})
