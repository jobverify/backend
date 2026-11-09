import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const okCreditModulePath = path.resolve(currentDir, '../../scraper/okcredit/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/okcredit/catalog.js')
  } catch {
    assert.fail('Expected OkCredit catalog module at ../../scraper/okcredit/catalog.js')
  }
}

test('OkCredit local catalog captures the verified first-party no-current-openings careers surface', async () => {
  const {
    OK_CREDIT_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OK_CREDIT_CATALOG)

  assert.equal(defaultCatalog, OK_CREDIT_CATALOG)
  assert.equal(provider.source, 'okcredit')
  assert.equal(provider.companyName, 'OkCredit')
  assert.equal(provider.officialBrandName, 'OkCredit')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://okcredit.in/')
  assert.equal(provider.companyCareerPage, 'https://okcredit.in/careers')
  assert.equal(provider.companyDomain, 'okcredit.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-no-open-jobs-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page-no-current-openings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/okcredit\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /We are not hiring at the moment/i)
  assert.match(provider.verifiedSurfaceSummary, /No Current Job Openings/i)
  assert.equal(provider.modulePath, okCreditModulePath)
  assert.match(provider.dryRunFile, /okcredit[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OkCredit'), false)
})

test('OkCredit backlog row matches directly from the local catalog metadata', async () => {
  const { OK_CREDIT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'OkCredit\n',
    catalog: [OK_CREDIT_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OkCredit', 'okcredit', 'OkCredit']],
  )
})

test('getScraperCatalog exposes OkCredit as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'okcredit')
  const scraper = buildScrapers().find((item) => item.name === 'okcredit')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'OkCredit')
  assert.equal(provider.companyCareerPage, 'https://okcredit.in/careers')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'OkCredit'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'OkCredit\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['OkCredit', 'okcredit', 'OkCredit']],
  )
})
