import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/quadeye/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/quadeye/catalog.js')
  } catch {
    assert.fail('Expected QuadEye catalog module at ../../scraper/quadeye/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/quadeye/script.js')
  } catch {
    assert.fail('Expected QuadEye scraper module at ../../scraper/quadeye/script.js')
  }
}

test('QuadEye local catalog captures the verified first-party careers page and public Zoho API metadata', async () => {
  const { QUADEYE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const quadeye = await loadScraperModule()

  assert.equal(defaultCatalog, QUADEYE_CATALOG)
  assert.equal(QUADEYE_CATALOG.source, 'quadeye')
  assert.equal(QUADEYE_CATALOG.companyName, 'QuadEye')
  assert.equal(QUADEYE_CATALOG.officialBrandName, 'Quadeye')
  assert.equal(QUADEYE_CATALOG.adapter, 'script')
  assert.equal(QUADEYE_CATALOG.homepageUrl, 'https://www.quadeye.com/')
  assert.equal(QUADEYE_CATALOG.companyCareerPage, 'https://www.quadeye.com/careers/')
  assert.equal(QUADEYE_CATALOG.careersPortalUrl, 'https://quadeye.zohorecruit.in/jobs/Careers/')
  assert.equal(
    QUADEYE_CATALOG.careersApiUrl,
    'https://quadeye.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(QUADEYE_CATALOG.careersDetailHost, 'career.quadeye.com')
  assert.equal(QUADEYE_CATALOG.companyDomain, 'quadeye.com')
  assert.equal(QUADEYE_CATALOG.atsPlatform, 'zohorecruit')
  assert.equal(QUADEYE_CATALOG.countryFilter, 'India')
  assert.equal(
    QUADEYE_CATALOG.paginationStrategy,
    'official-careers-page-plus-portal-api-inventory-equality',
  )
  assert.equal(
    QUADEYE_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+public-zoho-api+job-location-scope',
  )
  assert.equal(QUADEYE_CATALOG.parser, 'custom-script')
  assert.equal(QUADEYE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(QUADEYE_CATALOG.dryRunFile, 'quadeye/jobs.json')
  assert.match(QUADEYE_CATALOG.verifiedOn, /^\d{4}-\d{2}-\d{2}$/)
  assert.equal(QUADEYE_CATALOG.modulePath, modulePath)
  const verificationDate = new Date(QUADEYE_CATALOG.verifiedOn + 'T00:00:00Z')
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  assert.ok(QUADEYE_CATALOG.verifiedSurfaceSummary.includes(verificationDate))
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.quadeye\.com\/jobs/i)
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /quadeye\.cyralix\.com\/\/jobs/i)
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /branded Zoho portal and public API expose matching inventories/i)
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /portal\/API inventory equality/i)
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /Gurugram locations/i)
  assert.match(QUADEYE_CATALOG.verifiedSurfaceSummary, /career\.quadeye\.com/i)

  assert.equal(quadeye.PROVIDER_METADATA.source, QUADEYE_CATALOG.source)
  assert.equal(quadeye.PROVIDER_METADATA.companyName, QUADEYE_CATALOG.companyName)
  assert.equal(quadeye.PROVIDER_METADATA.careersPortalUrl, QUADEYE_CATALOG.careersPortalUrl)
})

test('QuadEye exact backlog row matches directly from the local provider metadata', async () => {
  const { QUADEYE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'QuadEye\n',
    catalog: [QUADEYE_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['QuadEye', 'quadeye', 'QuadEye']],
  )
})
