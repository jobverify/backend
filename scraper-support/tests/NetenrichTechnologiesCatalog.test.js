import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/netenrichtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Netenrich Technologies catalog module at ../../scraper/netenrichtechnologies/catalog.js')
  }
}

test('Netenrich Technologies catalog captures the verified first-party careers listing surface', async () => {
  const {
    NETENRICH_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, NETENRICH_TECHNOLOGIES_CATALOG)
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.source, 'netenrichtechnologies')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.companyName, 'Netenrich Technologies')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.officialBrandName, 'Netenrich')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://netenrich.com/careers')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.companyDomain, 'netenrich.com')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.atsPlatform, 'first-party-html-job-pages')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(
    NETENRICH_TECHNOLOGIES_CATALOG.paginationStrategy,
    'single-careers-page-plus-first-party-detail-pages',
  )
  assert.equal(
    NETENRICH_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+html-open-positions+first-party-detail-pages',
  )
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(NETENRICH_TECHNOLOGIES_CATALOG.verifiedOn, '2026-07-18')
  assert.match(NETENRICH_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Cloud Security Architect/i)
  assert.match(NETENRICH_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Technical Content Writer/i)
  assert.match(NETENRICH_TECHNOLOGIES_CATALOG.modulePath, /netenrichtechnologies[\\/]script\.js$/i)
})

test('Netenrich Technologies backlog matching works from the local catalog metadata', async () => {
  const { NETENRICH_TECHNOLOGIES_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Netenrich Technologies\n',
    catalog: [NETENRICH_TECHNOLOGIES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Netenrich Technologies', 'netenrichtechnologies', 'Netenrich Technologies']],
  )
})
