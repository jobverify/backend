import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fclModulePath = path.resolve(currentDir, '../../scraper/fcl/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fcl/catalog.js')
  } catch {
    assert.fail('Expected FCL catalog module at ../../scraper/fcl/catalog.js')
  }
}

const loadFclModule = async () => {
  try {
    return await import('../../scraper/fcl/script.js')
  } catch {
    assert.fail('Expected FCL scraper module at ../../scraper/fcl/script.js')
  }
}

test('FCL local catalog captures the verified no-public-jobs first-party surface', async () => {
  const { FCL_CATALOG } = await loadCatalogModule()
  const fcl = await loadFclModule()

  assert.equal(FCL_CATALOG.source, 'fcl')
  assert.equal(FCL_CATALOG.companyName, 'FCL')
  assert.equal(FCL_CATALOG.officialBrandName, 'Firefly Campus Laundry')
  assert.equal(FCL_CATALOG.adapter, 'script')
  assert.equal(FCL_CATALOG.homepageUrl, 'https://fcl.in/')
  assert.equal(FCL_CATALOG.companyCareerPage, 'https://fcl.in/')
  assert.equal(FCL_CATALOG.companyDomain, 'fcl.in')
  assert.equal(FCL_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(FCL_CATALOG.countryFilter, 'India')
  assert.equal(FCL_CATALOG.paginationStrategy, 'verified-homepage-plus-missing-first-party-careers-routes')
  assert.equal(
    FCL_CATALOG.extractionStrategy,
    'verified-homepage-no-careers-links+verified-missing-careers-routes-return-empty',
  )
  assert.equal(FCL_CATALOG.parser, 'custom-script')
  assert.equal(FCL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FCL_CATALOG.verifiedOn, '2026-07-15')
  assert.match(FCL_CATALOG.dryRunFile, /fcl[\\/]jobs\.json$/i)
  assert.equal(FCL_CATALOG.modulePath, fclModulePath)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\//i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /FIREFLY CAMPUS LAUNDRY/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/careers/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/career/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/jobs/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/join-us/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/openings/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/work-with-us/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /https:\/\/fcl\.in\/current-openings/i)
  assert.match(FCL_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(fcl.PROVIDER_METADATA.source, FCL_CATALOG.source)
  assert.equal(fcl.PROVIDER_METADATA.companyName, FCL_CATALOG.companyName)
  assert.equal(fcl.PROVIDER_METADATA.companyCareerPage, FCL_CATALOG.companyCareerPage)
})

test('FCL exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { FCL_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'FCL\n',
    catalog: [FCL_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FCL', 'fcl', 'FCL']],
  )
})
