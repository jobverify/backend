import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const adrosonicModulePath = path.resolve(currentDir, '../../scraper/adrosonic/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/adrosonic/catalog.js')
  } catch {
    assert.fail('Expected Adrosonic catalog module at ../../scraper/adrosonic/catalog.js')
  }
}

const loadAdrosonicModule = async () => {
  try {
    return await import('../../scraper/adrosonic/script.js')
  } catch {
    assert.fail('Expected Adrosonic scraper module at ../../scraper/adrosonic/script.js')
  }
}

test('Adrosonic local catalog captures the verified first-party careers and public Zoho Recruit surface', async () => {
  const { ADROSONIC_CATALOG } = await loadCatalogModule()
  const adrosonic = await loadAdrosonicModule()

  assert.equal(ADROSONIC_CATALOG.source, 'adrosonic')
  assert.equal(ADROSONIC_CATALOG.companyName, 'Adrosonic')
  assert.equal(ADROSONIC_CATALOG.officialBrandName, 'Adrosonic')
  assert.equal(ADROSONIC_CATALOG.adapter, 'script')
  assert.equal(ADROSONIC_CATALOG.companyCareerPage, 'https://adrosonic.com/careers/')
  assert.equal(ADROSONIC_CATALOG.homepageUrl, 'https://adrosonic.com/')
  assert.equal(ADROSONIC_CATALOG.careersPageUrl, 'https://adrosonic.com/careers/')
  assert.equal(ADROSONIC_CATALOG.careersPortalUrl, 'https://adrosonic.zohorecruit.in/jobs/Careers/')
  assert.equal(
    ADROSONIC_CATALOG.careersApiUrl,
    'https://adrosonic.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(ADROSONIC_CATALOG.atsPlatform, 'zohorecruit')
  assert.equal(ADROSONIC_CATALOG.countryFilter, 'India')
  assert.equal(ADROSONIC_CATALOG.paginationStrategy, 'official-careers-page-handoff-plus-public-zoho-api')
  assert.equal(
    ADROSONIC_CATALOG.extractionStrategy,
    'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  )
  assert.equal(ADROSONIC_CATALOG.parser, 'custom-script')
  assert.equal(ADROSONIC_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ADROSONIC_CATALOG.companyDomain, 'adrosonic.com')
  assert.equal(ADROSONIC_CATALOG.verifiedOn, '2026-07-14')
  assert.match(ADROSONIC_CATALOG.verifiedSurfaceSummary, /https:\/\/adrosonic\.com\//i)
  assert.match(ADROSONIC_CATALOG.verifiedSurfaceSummary, /https:\/\/adrosonic\.com\/careers\//i)
  assert.match(ADROSONIC_CATALOG.verifiedSurfaceSummary, /https:\/\/adrosonic\.zohorecruit\.in\/jobs\/Careers\//i)
  assert.match(ADROSONIC_CATALOG.verifiedSurfaceSummary, /public Zoho Recruit portal/i)
  assert.equal(ADROSONIC_CATALOG.modulePath, adrosonicModulePath)

  assert.equal(adrosonic.PROVIDER_METADATA.source, ADROSONIC_CATALOG.source)
  assert.equal(adrosonic.PROVIDER_METADATA.companyName, ADROSONIC_CATALOG.companyName)
  assert.equal(adrosonic.PROVIDER_METADATA.companyCareerPage, ADROSONIC_CATALOG.companyCareerPage)
  assert.equal(adrosonic.PROVIDER_METADATA.careersPortalUrl, ADROSONIC_CATALOG.careersPortalUrl)
  assert.equal(adrosonic.PROVIDER_METADATA.careersApiUrl, ADROSONIC_CATALOG.careersApiUrl)
})

test('buildScrapers and company coverage resolve Adrosonic from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'adrosonic')
  const scraper = buildScrapers().find((item) => item.name === 'adrosonic')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Adrosonic')
  assert.equal(provider.companyCareerPage, 'https://adrosonic.com/careers/')
  assert.match(scraper.dryRunFile, /adrosonic[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Adrosonic\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Adrosonic', 'adrosonic', 'Adrosonic']],
  )
})
