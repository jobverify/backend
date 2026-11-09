import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nexdigm/catalog.js')
  } catch {
    assert.fail('Expected Nexdigm catalog module at ../../scraper/nexdigm/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/nexdigm/script.js')
  } catch {
    assert.fail('Expected Nexdigm scraper module at ../../scraper/nexdigm/script.js')
  }
}

test('Nexdigm local catalog captures the verified August 4, 2026 careers shell and inline current-openings contract', async () => {
  const {
    NEXDIGM_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const nexdigm = await loadScriptModule()

  assert.equal(defaultCatalog, NEXDIGM_CATALOG)
  assert.equal(NEXDIGM_CATALOG.source, 'nexdigm')
  assert.equal(NEXDIGM_CATALOG.companyName, 'Nexdigm')
  assert.equal(NEXDIGM_CATALOG.officialBrandName, 'Nexdigm')
  assert.equal(NEXDIGM_CATALOG.adapter, 'script')
  assert.equal(NEXDIGM_CATALOG.officialHomepageUrl, 'https://www.nexdigm.com/')
  assert.equal(NEXDIGM_CATALOG.companyCareerPage, 'https://www.nexdigm.com/careers/')
  assert.equal(
    NEXDIGM_CATALOG.officialCurrentOpeningsUrl,
    'https://www.nexdigm.com/careers/current-openings/',
  )
  assert.equal(NEXDIGM_CATALOG.officialCurrentOpeningsDataUrl, 'https://www.nexdigm.com/joblist.php')
  assert.equal(NEXDIGM_CATALOG.reviewedUpstreamErrorValue, 'error code: 502')
  assert.equal(NEXDIGM_CATALOG.companyDomain, 'nexdigm.com')
  assert.equal(NEXDIGM_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(NEXDIGM_CATALOG.countryFilter, 'India')
  assert.equal(
    NEXDIGM_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-inline-current-openings-cards-single-page',
  )
  assert.equal(
    NEXDIGM_CATALOG.extractionStrategy,
    'verified-careers-page+verified-current-openings-shell+inline-card-parser+darwinbox-apply-handoff',
  )
  assert.equal(NEXDIGM_CATALOG.parser, 'custom-script')
  assert.equal(NEXDIGM_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(NEXDIGM_CATALOG.dryRunFile, 'nexdigm/jobs.json')
  assert.equal(NEXDIGM_CATALOG.verifiedOn, '2026-08-04')
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.nexdigm\.com\/careers\//i)
  assert.match(
    NEXDIGM_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.nexdigm\.com\/careers\/current-openings\//i,
  )
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /inline public job cards/i)
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /career-details\?id=/i)
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /Darwinbox apply handoffs/i)
  assert.match(NEXDIGM_CATALOG.verifiedSurfaceSummary, /error code:\s*502/i)
  assert.match(NEXDIGM_CATALOG.modulePath, /nexdigm[\\/]script\.js$/i)

  assert.equal(nexdigm.PROVIDER_METADATA.source, NEXDIGM_CATALOG.source)
  assert.equal(nexdigm.PROVIDER_METADATA.companyName, NEXDIGM_CATALOG.companyName)
  assert.equal(
    nexdigm.PROVIDER_METADATA.officialCurrentOpeningsDataUrl,
    NEXDIGM_CATALOG.officialCurrentOpeningsDataUrl,
  )
})

test('Nexdigm exact backlog row resolves directly from the local provider metadata', async () => {
  const { NEXDIGM_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Nexdigm\n',
    catalog: [NEXDIGM_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nexdigm', 'nexdigm', 'Nexdigm']],
  )
})
