import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const arkaFincapModulePath = path.resolve(currentDir, '../../scraper/arkafincap/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/arkafincap/catalog.js')
  } catch {
    assert.fail('Expected Arka Fincap catalog module at ../../scraper/arkafincap/catalog.js')
  }
}

const loadArkaFincapModule = async () => {
  try {
    return await import('../../scraper/arkafincap/script.js')
  } catch {
    assert.fail('Expected Arka Fincap scraper module at ../../scraper/arkafincap/script.js')
  }
}

test('Arka Fincap local catalog captures the verified first-party careers and public Zoho Recruit surface', async () => {
  const { ARKA_FINCAP_CATALOG } = await loadCatalogModule()
  const arkaFincap = await loadArkaFincapModule()

  assert.equal(ARKA_FINCAP_CATALOG.source, 'arkafincap')
  assert.equal(ARKA_FINCAP_CATALOG.companyName, 'Arka Fincap')
  assert.equal(ARKA_FINCAP_CATALOG.officialBrandName, 'Arka Fincap')
  assert.equal(ARKA_FINCAP_CATALOG.adapter, 'script')
  assert.equal(ARKA_FINCAP_CATALOG.companyCareerPage, 'https://www.arkafincap.com/life-at-arka')
  assert.equal(ARKA_FINCAP_CATALOG.homepageUrl, 'https://www.arkafincap.com/')
  assert.equal(ARKA_FINCAP_CATALOG.careersPageUrl, 'https://www.arkafincap.com/life-at-arka')
  assert.equal(ARKA_FINCAP_CATALOG.careersPortalUrl, 'https://arkafincap.zohorecruit.in/jobs/Careers')
  assert.equal(
    ARKA_FINCAP_CATALOG.careersApiUrl,
    'https://arkafincap.zohorecruit.in/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(ARKA_FINCAP_CATALOG.atsPlatform, 'zohorecruit')
  assert.equal(ARKA_FINCAP_CATALOG.countryFilter, 'India')
  assert.equal(ARKA_FINCAP_CATALOG.paginationStrategy, 'official-careers-page-handoff-plus-public-zoho-api')
  assert.equal(
    ARKA_FINCAP_CATALOG.extractionStrategy,
    'official-careers-page+branded-zohorecruit-portal+public-job-openings-api',
  )
  assert.equal(ARKA_FINCAP_CATALOG.parser, 'custom-script')
  assert.equal(ARKA_FINCAP_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ARKA_FINCAP_CATALOG.companyDomain, 'arkafincap.com')
  assert.equal(ARKA_FINCAP_CATALOG.verifiedOn, '2026-07-15')
  assert.match(ARKA_FINCAP_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.arkafincap\.com\//i)
  assert.match(ARKA_FINCAP_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.arkafincap\.com\/life-at-arka/i)
  assert.match(ARKA_FINCAP_CATALOG.verifiedSurfaceSummary, /https:\/\/arkafincap\.zohorecruit\.in\/jobs\/Careers/i)
  assert.match(ARKA_FINCAP_CATALOG.verifiedSurfaceSummary, /public Zoho Recruit portal/i)
  assert.match(ARKA_FINCAP_CATALOG.verifiedSurfaceSummary, /Data Architect/i)
  assert.equal(ARKA_FINCAP_CATALOG.modulePath, arkaFincapModulePath)

  assert.equal(arkaFincap.PROVIDER_METADATA.source, ARKA_FINCAP_CATALOG.source)
  assert.equal(arkaFincap.PROVIDER_METADATA.companyName, ARKA_FINCAP_CATALOG.companyName)
  assert.equal(arkaFincap.PROVIDER_METADATA.companyCareerPage, ARKA_FINCAP_CATALOG.companyCareerPage)
  assert.equal(arkaFincap.PROVIDER_METADATA.careersPortalUrl, ARKA_FINCAP_CATALOG.careersPortalUrl)
  assert.equal(arkaFincap.PROVIDER_METADATA.careersApiUrl, ARKA_FINCAP_CATALOG.careersApiUrl)
})

test('Arka Fincap coverage resolves the backlog company name without requiring an alias entry', async () => {
  const { ARKA_FINCAP_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Arka Fincap\nArka Fincap Limited\n',
    catalog: [ARKA_FINCAP_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Arka Fincap', 'arkafincap', 'Arka Fincap'],
      ['Arka Fincap Limited', 'arkafincap', 'Arka Fincap'],
    ],
  )
})

test('buildScrapers and company coverage resolve Arka Fincap from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arkafincap')
  const scraper = buildScrapers().find((item) => item.name === 'arkafincap')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Arka Fincap')
  assert.equal(provider.companyCareerPage, 'https://www.arkafincap.com/life-at-arka')
  assert.match(scraper.dryRunFile, /arkafincap[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Arka Fincap\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arka Fincap', 'arkafincap', 'Arka Fincap']],
  )
})
