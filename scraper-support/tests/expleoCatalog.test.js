import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expleoModulePath = path.resolve(currentDir, '../../scraper/expleo/script.js')

const loadExpleoCatalog = async () => {
  try {
    return await import('../../scraper/expleo/catalog.js')
  } catch {
    assert.fail('Expected Expleo catalog module at ../../scraper/expleo/catalog.js')
  }
}

test('Expleo catalog captures the verified first-party careers page and India iCIMS contracts', async () => {
  const {
    EXPLEO_CATALOG,
    default: defaultCatalog,
  } = await loadExpleoCatalog()

  assert.equal(defaultCatalog, EXPLEO_CATALOG)
  assert.equal(EXPLEO_CATALOG.source, 'expleo')
  assert.equal(EXPLEO_CATALOG.companyName, 'Expleo')
  assert.equal(EXPLEO_CATALOG.officialBrandName, 'Expleo')
  assert.equal(EXPLEO_CATALOG.adapter, 'script')
  assert.equal(EXPLEO_CATALOG.companyCareerPage, 'https://careers.expleo.com/en/')
  assert.equal(EXPLEO_CATALOG.companyDomain, 'expleo.com')
  assert.equal(EXPLEO_CATALOG.indiaJobsRootUrl, 'https://expleo-jobs-in-en.icims.com/')
  assert.equal(
    EXPLEO_CATALOG.indiaJobsSearchWrapperUrl,
    'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793',
  )
  assert.equal(
    EXPLEO_CATALOG.indiaJobsSearchIframeUrl,
    'https://expleo-jobs-in-en.icims.com/jobs/search?hashed=-435712793&in_iframe=1',
  )
  assert.equal(
    EXPLEO_CATALOG.officialJobDetailExampleUrl,
    'https://expleo-jobs-in-en.icims.com/jobs/54246/cae-modeller/job',
  )
  assert.equal(EXPLEO_CATALOG.atsPlatform, 'icims')
  assert.equal(EXPLEO_CATALOG.countryFilter, 'India')
  assert.equal(EXPLEO_CATALOG.paginationStrategy, 'icims-next-page-search')
  assert.equal(
    EXPLEO_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+verified-india-icims-wrapper+iframe-listings+detail-pages',
  )
  assert.equal(EXPLEO_CATALOG.parser, 'custom-script')
  assert.equal(EXPLEO_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EXPLEO_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(EXPLEO_CATALOG.modulePath, expleoModulePath)
  assert.match(EXPLEO_CATALOG.verifiedSurfaceSummary, /https:\/\/careers\.expleo\.com\/en\//i)
  assert.match(EXPLEO_CATALOG.verifiedSurfaceSummary, /https:\/\/expleo-jobs-in-en\.icims\.com\//i)
  assert.match(
    EXPLEO_CATALOG.verifiedSurfaceSummary,
    /https:\/\/expleo-jobs-in-en\.icims\.com\/jobs\/search\?hashed=-435712793/i,
  )
  assert.match(
    EXPLEO_CATALOG.verifiedSurfaceSummary,
    /https:\/\/expleo-jobs-in-en\.icims\.com\/jobs\/search\?hashed=-435712793&in_iframe=1/i,
  )
  assert.match(
    EXPLEO_CATALOG.verifiedSurfaceSummary,
    /https:\/\/expleo-jobs-in-en\.icims\.com\/jobs\/54246\/cae-modeller\/job/i,
  )
  assert.match(EXPLEO_CATALOG.verifiedSurfaceSummary, /CAE Modeller/i)
  assert.match(EXPLEO_CATALOG.verifiedSurfaceSummary, /Chennai/i)
})

test('Expleo backlog matching works directly from the local catalog metadata without an alias', async () => {
  const { EXPLEO_CATALOG } = await loadExpleoCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Expleo\n',
    catalog: [EXPLEO_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Expleo', 'expleo', 'Expleo']],
  )
})
