import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const droomModulePath = path.resolve(currentDir, '../../scraper/droom/script.js')

const loadDroomCatalog = async () => {
  try {
    return await import('../../scraper/droom/catalog.js')
  } catch {
    assert.fail('Expected Droom catalog module at ../../scraper/droom/catalog.js')
  }
}

test('Droom catalog captures the verified first-party inline jobs surface', async () => {
  const { DROOM_CATALOG } = await loadDroomCatalog()
  const provider = hydrateProviderCatalogEntry(DROOM_CATALOG)

  assert.equal(provider.source, 'droom')
  assert.equal(provider.companyName, 'Droom')
  assert.equal(provider.officialBrandName, 'Droom')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://droom.in/')
  assert.equal(provider.companyCareerPage, 'https://droom.in/career')
  assert.equal(provider.applicationFormUrl, 'https://droom.in/career#career-form')
  assert.deepEqual(provider.verified404RouteUrls, [
    'https://droom.in/careers',
    'https://droom.in/jobs',
    'https://droom.in/join-us',
    'https://droom.in/openings',
  ])
  assert.equal(provider.companyDomain, 'droom.in')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-inline-job-cards-on-single-first-party-careers-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-careers-page+inline-job-cards+shared-first-party-application-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, droomModulePath)
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /Now Hiring/i)
  assert.match(provider.verifiedSurfaceSummary, /Apply at Droom/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\/join-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/droom\.in\/openings/i)
  assert.match(provider.verifiedSurfaceSummary, /21 public job cards/i)
})

test('Droom backlog row matches directly from provider metadata without aliases', async () => {
  const { DROOM_CATALOG } = await loadDroomCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Droom\n',
    catalog: [hydrateProviderCatalogEntry(DROOM_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Droom', 'droom', 'Droom']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Droom'), false)
})
