import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const eltropyModulePath = path.resolve(currentDir, '../../scraper/eltropy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eltropy/catalog.js')
  } catch {
    assert.fail('Expected Eltropy catalog module at ../../scraper/eltropy/catalog.js')
  }
}

const loadEltropyModule = async () => {
  try {
    return await import('../../scraper/eltropy/script.js')
  } catch {
    assert.fail('Expected Eltropy scraper module at ../../scraper/eltropy/script.js')
  }
}

test('Eltropy local catalog captures the verified first-party careers page and Greenhouse India jobs surface', async () => {
  const { ELTROPY_CATALOG } = await loadCatalogModule()
  const eltropy = await loadEltropyModule()

  assert.equal(ELTROPY_CATALOG.source, 'eltropy')
  assert.equal(ELTROPY_CATALOG.companyName, 'Eltropy')
  assert.equal(ELTROPY_CATALOG.officialBrandName, 'Eltropy')
  assert.equal(ELTROPY_CATALOG.adapter, 'script')
  assert.equal(ELTROPY_CATALOG.officialHomepageUrl, 'https://eltropy.com/')
  assert.equal(ELTROPY_CATALOG.officialCareersLandingUrl, 'https://eltropy.com/careers/')
  assert.equal(ELTROPY_CATALOG.companyCareerPage, 'https://job-boards.greenhouse.io/eltropyinc')
  assert.equal(ELTROPY_CATALOG.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/eltropyinc')
  assert.equal(
    ELTROPY_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/eltropyinc/jobs',
  )
  assert.equal(ELTROPY_CATALOG.atsPlatform, 'greenhouse')
  assert.equal(ELTROPY_CATALOG.countryFilter, 'India')
  assert.equal(ELTROPY_CATALOG.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    ELTROPY_CATALOG.extractionStrategy,
    'verified-first-party-careers-page-or-blocked-official-surface+greenhouse-board+greenhouse-jobs-api+greenhouse-board-detail-url+india-location-filter',
  )
  assert.equal(ELTROPY_CATALOG.parser, 'custom-script')
  assert.equal(ELTROPY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ELTROPY_CATALOG.companyDomain, 'eltropy.com')
  assert.equal(ELTROPY_CATALOG.verifiedOn, '2026-10-03')
  assert.match(ELTROPY_CATALOG.dryRunFile, /eltropy[\\/]jobs\.json$/i)
  assert.equal(ELTROPY_CATALOG.modulePath, eltropyModulePath)
  assert.match(ELTROPY_CATALOG.verifiedSurfaceSummary, /https:\/\/eltropy\.com\/careers\//i)
  assert.match(ELTROPY_CATALOG.verifiedSurfaceSummary, /Cloudflare 403 Forbidden/i)
  assert.match(
    ELTROPY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/job-boards\.greenhouse\.io\/eltropyinc/i,
  )
  assert.match(
    ELTROPY_CATALOG.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/eltropyinc\/jobs\?content=true/i,
  )
  assert.match(ELTROPY_CATALOG.verifiedSurfaceSummary, /Senior Backend Engineer/i)
  assert.match(ELTROPY_CATALOG.verifiedSurfaceSummary, /Engineering Manager/i)

  assert.equal(eltropy.PROVIDER_METADATA.source, ELTROPY_CATALOG.source)
  assert.equal(eltropy.PROVIDER_METADATA.companyName, ELTROPY_CATALOG.companyName)
  assert.equal(eltropy.PROVIDER_METADATA.companyCareerPage, ELTROPY_CATALOG.companyCareerPage)
  assert.equal(
    eltropy.PROVIDER_METADATA.greenhouseJobsApiUrl,
    ELTROPY_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Eltropy backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { ELTROPY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Eltropy\n',
    catalog: [ELTROPY_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eltropy', 'eltropy', 'Eltropy']],
  )
})
