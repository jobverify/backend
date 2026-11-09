import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const exaModulePath = path.resolve(currentDir, '../../scraper/exa/script.js')

const loadExaCatalog = async () => {
  try {
    return await import('../../scraper/exa/catalog.js')
  } catch {
    assert.fail('Expected Exa catalog module at ../../scraper/exa/catalog.js')
  }
}

test('Exa catalog captures the verified first-party careers bundle and Ashby handoff metadata', async () => {
  const {
    EXA_CATALOG,
    default: defaultCatalog,
  } = await loadExaCatalog()

  assert.equal(defaultCatalog, EXA_CATALOG)
  assert.equal(EXA_CATALOG.source, 'exa')
  assert.equal(EXA_CATALOG.companyName, 'Exa')
  assert.equal(EXA_CATALOG.officialBrandName, 'Exa')
  assert.equal(EXA_CATALOG.legalEntityName, 'Exa Labs Inc.')
  assert.equal(EXA_CATALOG.adapter, 'script')
  assert.equal(EXA_CATALOG.officialHomepageUrl, 'https://exa.ai/')
  assert.equal(EXA_CATALOG.companyCareerPage, 'https://exa.ai/careers')
  assert.equal(
    EXA_CATALOG.verifiedCareersBundleUrl,
    'https://exa.ai/_next/static/chunks/app/careers/page-081cdf0c040ae1c4.js',
  )
  assert.equal(EXA_CATALOG.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/exa')
  assert.equal(
    EXA_CATALOG.ashbyJobBoardUrl,
    'https://api.ashbyhq.com/posting-api/job-board/exa',
  )
  assert.equal(
    EXA_CATALOG.officialJobDetailExampleUrl,
    'https://jobs.ashbyhq.com/exa/41eb773d-9909-422c-b6b8-5bbdc407d318',
  )
  assert.equal(EXA_CATALOG.companyDomain, 'exa.ai')
  assert.equal(EXA_CATALOG.atsPlatform, 'ashby')
  assert.equal(EXA_CATALOG.countryFilter, 'India')
  assert.equal(
    EXA_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-static-jobs-bundle-plus-public-ashby-job-board',
  )
  assert.equal(
    EXA_CATALOG.extractionStrategy,
    'verified-careers-page+verified-first-party-jobs-bundle+ashby-job-board-api+india-location-filter',
  )
  assert.equal(EXA_CATALOG.parser, 'custom-script')
  assert.equal(EXA_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EXA_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(EXA_CATALOG.modulePath, exaModulePath)
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /https:\/\/exa\.ai\/careers/i)
  assert.match(
    EXA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/exa\.ai\/_next\/static\/chunks\/app\/careers\/page-081cdf0c040ae1c4\.js/i,
  )
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/exa/i)
  assert.match(
    EXA_CATALOG.verifiedSurfaceSummary,
    /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/exa/i,
  )
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /San Francisco/i)
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /New York City/i)
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /Singapore/i)
  assert.match(EXA_CATALOG.verifiedSurfaceSummary, /no India roles/i)
})

test('Exa backlog matching works directly from the local catalog metadata without an alias', async () => {
  const { EXA_CATALOG } = await loadExaCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Exa\n',
    catalog: [EXA_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Exa', 'exa', 'Exa']],
  )
})
