import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const indusIndBankModulePath = path.resolve(currentDir, '../../scraper/indusindbank/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indusindbank/catalog.js')
  } catch {
    assert.fail('Expected IndusInd Bank catalog module at ../../scraper/indusindbank/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/indusindbank/script.js')
  } catch {
    assert.fail('Expected IndusInd Bank scraper module at ../../scraper/indusindbank/script.js')
  }
}

test('IndusInd Bank local catalog captures the verified homepage handoff, Workline public jobs API, and public detail-route surface', async () => {
  const { INDUSIND_BANK_CATALOG } = await loadCatalogModule()
  const indusIndBank = await loadScriptModule()

  assert.equal(INDUSIND_BANK_CATALOG.source, 'indusindbank')
  assert.equal(INDUSIND_BANK_CATALOG.companyName, 'IndusInd Bank')
  assert.equal(INDUSIND_BANK_CATALOG.officialBrandName, 'IndusInd Bank')
  assert.equal(INDUSIND_BANK_CATALOG.adapter, 'script')
  assert.equal(INDUSIND_BANK_CATALOG.companyCareerPage, 'https://app1100.workline.hr/careers/')
  assert.equal(INDUSIND_BANK_CATALOG.homepageUrl, 'https://www.indusind.bank.in/')
  assert.equal(INDUSIND_BANK_CATALOG.jobsBoardUrl, 'https://app1100.workline.hr/Cportal/GeneralOpening.aspx')
  assert.equal(
    INDUSIND_BANK_CATALOG.jobsApiUrl,
    'https://app1100.workline.hr/rec/TAServices.asmx/GetCurrentopening',
  )
  assert.equal(
    INDUSIND_BANK_CATALOG.sampleDetailUrl,
    'https://app1100.workline.hr/CandidatePortal/1f788ee8-158a-43ce-bab2-839248e14729/HR-Analyst-Job-in-One-World-Centre-9th-Floor-Office-86797',
  )
  assert.equal(INDUSIND_BANK_CATALOG.companyDomain, 'indusind.bank.in')
  assert.equal(INDUSIND_BANK_CATALOG.atsPlatform, 'workline-public-jobs-api')
  assert.equal(INDUSIND_BANK_CATALOG.countryFilter, 'India')
  assert.equal(
    INDUSIND_BANK_CATALOG.paginationStrategy,
    'verified-homepage-handoff-plus-single-workline-current-opening-api',
  )
  assert.equal(
    INDUSIND_BANK_CATALOG.extractionStrategy,
    'verified-homepage+verified-workline-careers-landing+workline-board-page+currentopening-json-api+public-detail-pages',
  )
  assert.equal(INDUSIND_BANK_CATALOG.parser, 'custom-script')
  assert.equal(INDUSIND_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INDUSIND_BANK_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(INDUSIND_BANK_CATALOG.dryRunFile, 'indusindbank/jobs.json')
  assert.equal(INDUSIND_BANK_CATALOG.modulePath, indusIndBankModulePath)
  assert.match(INDUSIND_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.indusind\.bank\.in\//i)
  assert.match(INDUSIND_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/app1100\.workline\.hr\/careers\//i)
  assert.match(
    INDUSIND_BANK_CATALOG.verifiedSurfaceSummary,
    /https:\/\/app1100\.workline\.hr\/rec\/TAServices\.asmx\/GetCurrentopening/i,
  )
  assert.match(INDUSIND_BANK_CATALOG.verifiedSurfaceSummary, /\b11 live job records\b/i)
  assert.match(INDUSIND_BANK_CATALOG.verifiedSurfaceSummary, /HR-Analyst-Job-in-One-World-Centre/i)

  assert.equal(indusIndBank.PROVIDER_METADATA.source, INDUSIND_BANK_CATALOG.source)
  assert.equal(indusIndBank.PROVIDER_METADATA.companyName, INDUSIND_BANK_CATALOG.companyName)
  assert.equal(indusIndBank.PROVIDER_METADATA.jobsApiUrl, INDUSIND_BANK_CATALOG.jobsApiUrl)
})

test('IndusInd Bank exact backlog row resolves from local provider metadata without aliases', async () => {
  const { INDUSIND_BANK_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'IndusInd Bank\n',
    catalog: [INDUSIND_BANK_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IndusInd Bank', 'indusindbank', 'IndusInd Bank']],
  )
})

test('getScraperCatalog includes IndusInd Bank as a verified public Workline provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'indusindbank')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'IndusInd Bank')
  assert.equal(provider.companyCareerPage, 'https://app1100.workline.hr/careers/')
  assert.equal(provider.companyDomain, 'indusind.bank.in')
  assert.equal(provider.atsPlatform, 'workline-public-jobs-api')
  assert.match(provider.modulePath, /indusindbank[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable IndusInd Bank scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'indusindbank')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'indusindbank')
  assert.equal(scraper.provider.atsPlatform, 'workline-public-jobs-api')
  assert.match(scraper.dryRunFile, /indusindbank[\\/]jobs\.json$/i)
})
