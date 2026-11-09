import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const enduranceModulePath = path.resolve(currentDir, '../../scraper/endurance/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/endurance/catalog.js')
  } catch {
    assert.fail('Expected Endurance catalog module at ../../scraper/endurance/catalog.js')
  }
}

const loadEnduranceModule = async () => {
  try {
    return await import('../../scraper/endurance/script.js')
  } catch {
    assert.fail('Expected Endurance scraper module at ../../scraper/endurance/script.js')
  }
}

test('Endurance local catalog captures the verified first-party careers and job portal surface', async () => {
  const { ENDURANCE_CATALOG } = await loadCatalogModule()
  const endurance = await loadEnduranceModule()

  assert.equal(ENDURANCE_CATALOG.source, 'endurance')
  assert.equal(ENDURANCE_CATALOG.companyName, 'Endurance')
  assert.equal(ENDURANCE_CATALOG.officialBrandName, 'Endurance Technologies Limited')
  assert.equal(ENDURANCE_CATALOG.adapter, 'script')
  assert.equal(ENDURANCE_CATALOG.officialHomepageUrl, 'https://www.endurancegroup.com/')
  assert.equal(ENDURANCE_CATALOG.officialCareersLandingUrl, 'https://www.endurancegroup.com/careers/')
  assert.equal(ENDURANCE_CATALOG.companyCareerPage, 'https://www.endurancegroup.com/careers/job-portal/')
  assert.equal(
    ENDURANCE_CATALOG.officialJobDetailExampleUrl,
    'https://www.endurancegroup.com/career/technical-architect/',
  )
  assert.equal(ENDURANCE_CATALOG.atsPlatform, 'first-party-careers-page-and-job-portal')
  assert.equal(ENDURANCE_CATALOG.countryFilter, 'India')
  assert.equal(ENDURANCE_CATALOG.paginationStrategy, 'single-first-party-job-portal-html')
  assert.equal(
    ENDURANCE_CATALOG.extractionStrategy,
    'verified-browser-rendered-careers-page+job-portal+same-domain-detail-pages',
  )
  assert.equal(ENDURANCE_CATALOG.parser, 'custom-script')
  assert.equal(ENDURANCE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ENDURANCE_CATALOG.companyDomain, 'endurancegroup.com')
  assert.equal(ENDURANCE_CATALOG.verifiedOn, '2026-08-14')
  assert.match(ENDURANCE_CATALOG.dryRunFile, /endurance[\\/]jobs\.json$/i)
  assert.equal(ENDURANCE_CATALOG.modulePath, enduranceModulePath)
  assert.match(ENDURANCE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.endurancegroup\.com\/$/i)
  assert.match(
    ENDURANCE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.endurancegroup\.com\/careers\//i,
  )
  assert.match(
    ENDURANCE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.endurancegroup\.com\/careers\/job-portal\//i,
  )
  assert.match(
    ENDURANCE_CATALOG.verifiedSurfaceSummary,
    /https:\/\/www\.endurancegroup\.com\/career\/technical-architect\//i,
  )
  assert.match(ENDURANCE_CATALOG.verifiedSurfaceSummary, /\b403\b/i)
  assert.match(ENDURANCE_CATALOG.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(ENDURANCE_CATALOG.verifiedSurfaceSummary, /Technical Architect/i)
  assert.match(ENDURANCE_CATALOG.verifiedSurfaceSummary, /Technical Lead - Hardware/i)

  assert.equal(endurance.PROVIDER_METADATA.source, ENDURANCE_CATALOG.source)
  assert.equal(endurance.PROVIDER_METADATA.companyName, ENDURANCE_CATALOG.companyName)
  assert.equal(endurance.PROVIDER_METADATA.companyCareerPage, ENDURANCE_CATALOG.companyCareerPage)
  assert.equal(
    endurance.PROVIDER_METADATA.officialJobDetailExampleUrl,
    ENDURANCE_CATALOG.officialJobDetailExampleUrl,
  )
})

test('Endurance backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { ENDURANCE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Endurance\n',
    catalog: [ENDURANCE_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Endurance', 'endurance', 'Endurance']],
  )
})
