import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const evalueserveModulePath = path.resolve(currentDir, '../../scraper/evalueserve/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/evalueserve/catalog.js')
  } catch {
    assert.fail('Expected Evalueserve catalog module at ../../scraper/evalueserve/catalog.js')
  }
}

const loadEvalueserveModule = async () => {
  try {
    return await import('../../scraper/evalueserve/script.js')
  } catch {
    assert.fail('Expected Evalueserve scraper module at ../../scraper/evalueserve/script.js')
  }
}

test('Evalueserve local catalog captures the verified first-party careers, jobs page, and Darwinbox handoff surface', async () => {
  const { EVALUESERVE_CATALOG } = await loadCatalogModule()
  const evalueserve = await loadEvalueserveModule()

  assert.equal(EVALUESERVE_CATALOG.source, 'evalueserve')
  assert.equal(EVALUESERVE_CATALOG.companyName, 'Evalueserve')
  assert.equal(EVALUESERVE_CATALOG.officialBrandName, 'Evalueserve')
  assert.equal(EVALUESERVE_CATALOG.adapter, 'script')
  assert.equal(EVALUESERVE_CATALOG.homepageUrl, 'https://www.evalueserve.com/')
  assert.equal(EVALUESERVE_CATALOG.companyCareerPage, 'https://www.evalueserve.com/careers/')
  assert.equal(EVALUESERVE_CATALOG.jobsPageUrl, 'https://www.evalueserve.com/jobs/')
  assert.equal(EVALUESERVE_CATALOG.darwinboxBaseUrl, 'https://lighthouse.darwinbox.com/')
  assert.equal(
    EVALUESERVE_CATALOG.verifiedExampleJobUrl,
    'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
  )
  assert.equal(EVALUESERVE_CATALOG.atsPlatform, 'first-party-jobs-page-plus-darwinbox-handoff')
  assert.equal(EVALUESERVE_CATALOG.countryFilter, 'India')
  assert.equal(EVALUESERVE_CATALOG.paginationStrategy, 'single-first-party-jobs-page-html')
  assert.equal(
    EVALUESERVE_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-jobs-page+inline-job-cards+darwinbox-learn-more-links+india-filter',
  )
  assert.equal(EVALUESERVE_CATALOG.parser, 'custom-script')
  assert.equal(EVALUESERVE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EVALUESERVE_CATALOG.companyDomain, 'evalueserve.com')
  assert.equal(EVALUESERVE_CATALOG.verifiedOn, '2026-07-15')
  assert.match(EVALUESERVE_CATALOG.dryRunFile, /evalueserve[\\/]jobs\.json$/i)
  assert.equal(EVALUESERVE_CATALOG.modulePath, evalueserveModulePath)
  assert.match(EVALUESERVE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.evalueserve\.com\/careers\//i)
  assert.match(EVALUESERVE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.evalueserve\.com\/jobs\//i)
  assert.match(EVALUESERVE_CATALOG.verifiedSurfaceSummary, /https:\/\/lighthouse\.darwinbox\.com\//i)
  assert.match(EVALUESERVE_CATALOG.verifiedSurfaceSummary, /Senior Trainer/i)
  assert.match(EVALUESERVE_CATALOG.verifiedSurfaceSummary, /Consultant-Devops/i)

  assert.equal(evalueserve.PROVIDER_METADATA.source, EVALUESERVE_CATALOG.source)
  assert.equal(evalueserve.PROVIDER_METADATA.companyName, EVALUESERVE_CATALOG.companyName)
  assert.equal(
    evalueserve.PROVIDER_METADATA.companyCareerPage,
    EVALUESERVE_CATALOG.companyCareerPage,
  )
  assert.equal(evalueserve.PROVIDER_METADATA.jobsPageUrl, EVALUESERVE_CATALOG.jobsPageUrl)
})

test('Evalueserve exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { EVALUESERVE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Evalueserve\n',
    catalog: [EVALUESERVE_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Evalueserve', 'evalueserve', 'Evalueserve']],
  )
})
