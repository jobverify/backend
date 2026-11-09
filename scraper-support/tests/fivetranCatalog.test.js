import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fivetran/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fivetran/catalog.js')
  } catch {
    assert.fail('Expected Fivetran catalog module at ../../scraper/fivetran/catalog.js')
  }
}

test('Fivetran catalog captures the verified first-party careers page and Greenhouse handoff contract', async () => {
  const {
    FIVETRAN_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()

  assert.equal(defaultCatalog, FIVETRAN_CATALOG)
  assert.equal(FIVETRAN_CATALOG.source, 'fivetran')
  assert.equal(FIVETRAN_CATALOG.companyName, 'Fivetran')
  assert.equal(FIVETRAN_CATALOG.officialBrandName, 'Fivetran')
  assert.equal(FIVETRAN_CATALOG.adapter, 'script')
  assert.equal(FIVETRAN_CATALOG.companyCareerPage, 'https://www.fivetran.com/careers')
  assert.equal(FIVETRAN_CATALOG.officialCareersLandingUrl, 'https://www.fivetran.com/careers')
  assert.equal(
    FIVETRAN_CATALOG.greenhouseAlertUrl,
    'https://my.greenhouse.io/users/sign_in?job_board=fivetran',
  )
  assert.equal(FIVETRAN_CATALOG.greenhouseBoardSlug, 'fivetran')
  assert.equal(FIVETRAN_CATALOG.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/fivetran')
  assert.equal(
    FIVETRAN_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/fivetran/jobs',
  )
  assert.equal(FIVETRAN_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(FIVETRAN_CATALOG.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    FIVETRAN_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+greenhouse-alert-board-slug+greenhouse-board-redirect+derived-greenhouse-jobs-api',
  )
  assert.equal(FIVETRAN_CATALOG.parser, 'custom-script')
  assert.equal(FIVETRAN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FIVETRAN_CATALOG.companyDomain, 'fivetran.com')
  assert.equal(FIVETRAN_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(FIVETRAN_CATALOG.modulePath, modulePath)
  assert.match(FIVETRAN_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.fivetran\.com\/careers/i)
  assert.match(
    FIVETRAN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/my\.greenhouse\.io\/users\/sign_in\?job_board=fivetran/i,
  )
  assert.match(
    FIVETRAN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/job-boards\.greenhouse\.io\/fivetran/i,
  )
  assert.match(
    FIVETRAN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/fivetran\/jobs\?content=true/i,
  )
  assert.match(
    FIVETRAN_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.fivetran\.com\/careers\/job\?gh_jid=\.\.\.\./i,
  )
  assert.match(FIVETRAN_CATALOG.verifiedSurfaceSummary, /Bengaluru \| India/i)
  assert.match(FIVETRAN_CATALOG.verifiedSurfaceSummary, /Sydney \| Australia/i)
})

test('Fivetran backlog matching works directly from the local catalog metadata without an alias', async () => {
  const { FIVETRAN_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Fivetran\n',
    catalog: [FIVETRAN_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fivetran', 'fivetran', 'Fivetran']],
  )
})
