import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/newfolddigital.workday/catalog.js')
  } catch {
    assert.fail('Expected NewFold Digital catalog module at ../../scraper/newfolddigital.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/newfolddigital.workday/script.js')
  } catch {
    assert.fail('Expected NewFold Digital scraper module at ../../scraper/newfolddigital.workday/script.js')
  }
}

test('NewFold Digital local catalog captures the verified official careers handoff and public Workday India contract', async () => {
  const {
    NEWFOLD_DIGITAL_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const newFoldDigital = await loadScriptModule()

  assert.equal(defaultCatalog, NEWFOLD_DIGITAL_CATALOG)
  assert.equal(NEWFOLD_DIGITAL_CATALOG.source, 'newfolddigital')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.companyName, 'NewFold Digital')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.officialBrandName, 'NewFold Digital')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.adapter, 'script')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.officialHomepageUrl, 'https://www.newfold.com/')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.companyCareerPage, 'https://www.newfold.com/careers')
  assert.equal(
    NEWFOLD_DIGITAL_CATALOG.officialWorkdayBoardUrl,
    'https://web.wd1.myworkdayjobs.com/ExternalCareerSite',
  )
  assert.equal(
    NEWFOLD_DIGITAL_CATALOG.jobsApiUrl,
    'https://web.wd1.myworkdayjobs.com/wday/cxs/web/ExternalCareerSite/jobs',
  )
  assert.deepEqual(NEWFOLD_DIGITAL_CATALOG.verifiedIndiaLocationNames, [
    'India - Remote',
    'Mumbai, India',
  ])
  assert.equal(NEWFOLD_DIGITAL_CATALOG.companyDomain, 'newfold.com')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.atsPlatform, 'workday')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.countryFilter, 'India')
  assert.equal(
    NEWFOLD_DIGITAL_CATALOG.paginationStrategy,
    'verified-public-workday-board-plus-india-location-facets',
  )
  assert.equal(
    NEWFOLD_DIGITAL_CATALOG.extractionStrategy,
    'verified-official-careers-page+verified-public-workday-board+unfiltered-workday-jobs-api+india-location-facets+filtered-workday-jobs-api',
  )
  assert.equal(NEWFOLD_DIGITAL_CATALOG.parser, 'custom-script')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.dryRunFile, 'newfolddigital.workday/jobs.json')
  assert.equal(NEWFOLD_DIGITAL_CATALOG.verifiedOn, '2026-07-16')
  assert.match(NEWFOLD_DIGITAL_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.newfold\.com\/careers/i)
  assert.match(
    NEWFOLD_DIGITAL_CATALOG.verifiedSurfaceSummary,
    /https:\/\/web\.wd1\.myworkdayjobs\.com\/ExternalCareerSite/i,
  )
  assert.match(
    NEWFOLD_DIGITAL_CATALOG.verifiedSurfaceSummary,
    /https:\/\/web\.wd1\.myworkdayjobs\.com\/wday\/cxs\/web\/ExternalCareerSite\/jobs/i,
  )
  assert.match(NEWFOLD_DIGITAL_CATALOG.verifiedSurfaceSummary, /India - Remote/i)
  assert.match(NEWFOLD_DIGITAL_CATALOG.verifiedSurfaceSummary, /Mumbai, India/i)
  assert.match(NEWFOLD_DIGITAL_CATALOG.modulePath, /newfolddigital\.workday[\\/]script\.js$/i)

  assert.equal(newFoldDigital.PROVIDER_METADATA.source, NEWFOLD_DIGITAL_CATALOG.source)
  assert.equal(newFoldDigital.PROVIDER_METADATA.companyName, NEWFOLD_DIGITAL_CATALOG.companyName)
  assert.equal(
    newFoldDigital.PROVIDER_METADATA.officialWorkdayBoardUrl,
    NEWFOLD_DIGITAL_CATALOG.officialWorkdayBoardUrl,
  )
})

test('NewFold Digital exact backlog row resolves directly from the local provider metadata', async () => {
  const { NEWFOLD_DIGITAL_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'NewFold Digital\n',
    catalog: [NEWFOLD_DIGITAL_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NewFold Digital', 'newfolddigital', 'NewFold Digital']],
  )
})
