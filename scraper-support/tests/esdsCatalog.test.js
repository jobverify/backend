import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const esdsModulePath = path.resolve(currentDir, '../../scraper/esds/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/esds/catalog.js')
  } catch {
    assert.fail('Expected ESDS catalog module at ../../scraper/esds/catalog.js')
  }
}

const loadEsdsModule = async () => {
  try {
    return await import('../../scraper/esds/script.js')
  } catch {
    assert.fail('Expected ESDS scraper module at ../../scraper/esds/script.js')
  }
}

test('ESDS local catalog preserves Darwinbox identity while disclosing the unresolved current public contract', async () => {
  const { ESDS_CATALOG } = await loadCatalogModule()
  const esds = await loadEsdsModule()

  assert.equal(ESDS_CATALOG.source, 'esds')
  assert.equal(ESDS_CATALOG.companyName, 'ESDS')
  assert.equal(ESDS_CATALOG.officialBrandName, 'ESDS Software Solution Limited')
  assert.equal(ESDS_CATALOG.adapter, 'script')
  assert.equal(ESDS_CATALOG.officialHomepageUrl, 'https://www.esds.co.in/')
  assert.equal(ESDS_CATALOG.officialCareersLandingUrl, 'https://www.esds.co.in/careers/')
  assert.equal(ESDS_CATALOG.companyCareerPage, 'https://www.esds.co.in/careers/')
  assert.equal(
    ESDS_CATALOG.officialCareersHandoffUrl,
    'https://esds.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(ESDS_CATALOG.darwinboxOrigin, 'https://esds.darwinbox.in')
  assert.equal(ESDS_CATALOG.darwinboxCompanyId, 'main')
  assert.equal(
    ESDS_CATALOG.publicAllJobsUrl,
    'https://esds.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(
    ESDS_CATALOG.officialJobDetailExampleUrl,
    'https://www.esds.co.in/career-details/a688746f77752a',
  )
  assert.equal(
    ESDS_CATALOG.darwinboxApplyHandoffUrlExample,
    'https://esds.darwinbox.in/ms/candidate/candidate/login?redirect=%2Fms%2Fcandidate%2Fcareers%2Fa688746f77752a___apply%3D1',
  )
  assert.equal(ESDS_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(ESDS_CATALOG.countryFilter, 'India')
  assert.equal(
    ESDS_CATALOG.paginationStrategy,
    'unresolved-native-inventory+corporate-discovery-and-closing-reconciliation',
  )
  assert.equal(
    ESDS_CATALOG.extractionStrategy,
    'active-corporate-cards+advertised-public-get-details+fail-closed-incomplete-inventory',
  )
  assert.equal(ESDS_CATALOG.parser, 'custom-script')
  assert.equal(ESDS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ESDS_CATALOG.companyDomain, 'esds.co.in')
  assert.equal(ESDS_CATALOG.verifiedOn, '2026-10-26')
  assert.equal(ESDS_CATALOG.nativeExtractionVerified, false)
  assert.equal(ESDS_CATALOG.fullInventoryVerified, false)
  assert.match(ESDS_CATALOG.dryRunFile, /esds[\\/]jobs\.json$/i)
  assert.equal(ESDS_CATALOG.modulePath, esdsModulePath)
  assert.match(ESDS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.esds\.co\.in\/careers\//i)
  assert.match(
    ESDS_CATALOG.verifiedSurfaceSummary,
    /https:\/\/esds\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(
    ESDS_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.esds\.co\.in\/career-details\/a688746f77752a/i,
  )
  assert.match(ESDS_CATALOG.verifiedSurfaceSummary, /Data Center Project Manager/i)
  assert.match(ESDS_CATALOG.verifiedSurfaceSummary, /HTTP 403/i)

  assert.equal(esds.PROVIDER_METADATA.source, ESDS_CATALOG.source)
  assert.equal(esds.PROVIDER_METADATA.companyName, ESDS_CATALOG.companyName)
  assert.equal(esds.PROVIDER_METADATA.companyCareerPage, ESDS_CATALOG.companyCareerPage)
  assert.equal(
    esds.PROVIDER_METADATA.officialCareersHandoffUrl,
    ESDS_CATALOG.officialCareersHandoffUrl,
  )
  assert.equal(
    esds.PROVIDER_METADATA.officialJobDetailExampleUrl,
    ESDS_CATALOG.officialJobDetailExampleUrl,
  )
})

test('ESDS backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { ESDS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'ESDS\n',
    catalog: [ESDS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ESDS', 'esds', 'ESDS']],
  )
})
