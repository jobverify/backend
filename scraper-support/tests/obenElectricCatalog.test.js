import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadObenElectricCatalog = async () => {
  try {
    return await import('../../scraper/obenelectric/catalog.js')
  } catch {
    assert.fail('Expected Oben Electric catalog module at ../../scraper/obenelectric/catalog.js')
  }
}

test('Oben Electric catalog captures the verified first-party careers handoff and public Zoho API metadata', async () => {
  const {
    OBEN_ELECTRIC_CATALOG,
    default: defaultCatalog,
  } = await loadObenElectricCatalog()

  assert.equal(defaultCatalog, OBEN_ELECTRIC_CATALOG)
  assert.equal(OBEN_ELECTRIC_CATALOG.source, 'obenelectric')
  assert.equal(OBEN_ELECTRIC_CATALOG.companyName, 'Oben Electric')
  assert.equal(OBEN_ELECTRIC_CATALOG.officialBrandName, 'Oben Electric')
  assert.equal(OBEN_ELECTRIC_CATALOG.adapter, 'script')
  assert.equal(OBEN_ELECTRIC_CATALOG.officialHomepageUrl, 'https://obenelectric.com/')
  assert.equal(OBEN_ELECTRIC_CATALOG.officialAboutPageUrl, 'https://obenelectric.com/about-us')
  assert.equal(
    OBEN_ELECTRIC_CATALOG.companyCareerPage,
    'https://careers.obenelectric.com/jobs/Careers',
  )
  assert.equal(
    OBEN_ELECTRIC_CATALOG.careersApiUrl,
    'https://careers.obenelectric.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(OBEN_ELECTRIC_CATALOG.companyDomain, 'obenelectric.com')
  assert.equal(OBEN_ELECTRIC_CATALOG.atsPlatform, 'zohorecruit')
  assert.equal(OBEN_ELECTRIC_CATALOG.countryFilter, 'India')
  assert.equal(
    OBEN_ELECTRIC_CATALOG.paginationStrategy,
    'official-about-page-handoff-plus-public-zoho-api',
  )
  assert.equal(
    OBEN_ELECTRIC_CATALOG.extractionStrategy,
    'verified-about-page+verified-custom-zohorecruit-portal+public-job-openings-api',
  )
  assert.equal(OBEN_ELECTRIC_CATALOG.parser, 'custom-script')
  assert.equal(OBEN_ELECTRIC_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(OBEN_ELECTRIC_CATALOG.dryRunFile, 'obenelectric/jobs.json')
  assert.equal(OBEN_ELECTRIC_CATALOG.verifiedOn, '2026-07-17')
  assert.match(OBEN_ELECTRIC_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(OBEN_ELECTRIC_CATALOG.verifiedSurfaceSummary, /https:\/\/obenelectric\.com\/about-us/i)
  assert.match(
    OBEN_ELECTRIC_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.obenelectric\.com\/jobs\/Careers/i,
  )
  assert.match(
    OBEN_ELECTRIC_CATALOG.verifiedSurfaceSummary,
    /https:\/\/careers\.obenelectric\.com\/recruit\/v2\/public\/Job_Openings/i,
  )
  assert.match(OBEN_ELECTRIC_CATALOG.modulePath, /obenelectric[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oben Electric'), false)
})

test('Oben Electric exact backlog row resolves directly from the local provider metadata', async () => {
  const { OBEN_ELECTRIC_CATALOG } = await loadObenElectricCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Oben Electric\n',
    catalog: [OBEN_ELECTRIC_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oben Electric', 'obenelectric', 'Oben Electric']],
  )
})

test('getScraperCatalog exposes Oben Electric as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'obenelectric')
  const scraper = buildScrapers().find((item) => item.name === 'obenelectric')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Oben Electric')
  assert.equal(provider.companyCareerPage, 'https://careers.obenelectric.com/jobs/Careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Oben Electric'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Oben Electric\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Oben Electric', 'obenelectric', 'Oben Electric']],
  )
})
