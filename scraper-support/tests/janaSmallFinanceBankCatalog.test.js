import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/janasmallfinancebank/catalog.js')
  } catch {
    assert.fail(
      'Expected Jana Small Finance Bank catalog module at ../../scraper/janasmallfinancebank/catalog.js',
    )
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/janasmallfinancebank/script.js')
  } catch {
    assert.fail(
      'Expected Jana Small Finance Bank scraper module at ../../scraper/janasmallfinancebank/script.js',
    )
  }
}

test('Jana Small Finance Bank local catalog captures the verified empty-board sentinel contract', async () => {
  const { JANA_SMALL_FINANCE_BANK_CATALOG } = await loadCatalogModule()
  const janaSmallFinanceBank = await loadScraperModule()

  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.source, 'janasmallfinancebank')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.companyName, 'Jana Small Finance Bank')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.officialBrandName, 'Jana Small Finance Bank')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.adapter, 'script')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.modulePath, '../../scraper/janasmallfinancebank/script.js')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.homepageUrl, 'https://www.jana.bank.in/')
  assert.equal(
    JANA_SMALL_FINANCE_BANK_CATALOG.companyCareerPage,
    'https://www.jana.bank.in/about-us/careers-hm/',
  )
  assert.equal(
    JANA_SMALL_FINANCE_BANK_CATALOG.currentOpeningsPageUrl,
    'https://www.jana.bank.in/index.php/career/current-openings',
  )
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.companyDomain, 'jana.bank.in')
  assert.equal(
    JANA_SMALL_FINANCE_BANK_CATALOG.atsPlatform,
    'official-company-site-no-trustworthy-public-jobs',
  )
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.countryFilter, 'India')
  assert.equal(
    JANA_SMALL_FINANCE_BANK_CATALOG.paginationStrategy,
    'verified-homepage-plus-careers-page-plus-linked-current-openings-surface-validation',
  )
  assert.equal(
    JANA_SMALL_FINANCE_BANK_CATALOG.extractionStrategy,
    'verified-first-party-careers-surface-with-no-public-jobs-handoff-return-empty',
  )
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.parser, 'custom-script')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.verifiedOn, '2026-07-26')
  assert.match(JANA_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /Sunday, July 26, 2026/i)
  assert.match(JANA_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.jana\.bank\.in\/about-us\/careers-hm\//i)
  assert.match(JANA_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.jana\.bank\.in\/index\.php\/career\/current-openings/i)
  assert.match(JANA_SMALL_FINANCE_BANK_CATALOG.verifiedSurfaceSummary, /no-public-jobs 404 page/i)
  assert.equal(JANA_SMALL_FINANCE_BANK_CATALOG.dryRunFile, 'janasmallfinancebank/jobs.json')

  assert.equal(
    janaSmallFinanceBank.PROVIDER_METADATA.source,
    JANA_SMALL_FINANCE_BANK_CATALOG.source,
  )
  assert.equal(
    janaSmallFinanceBank.PROVIDER_METADATA.currentOpeningsPageUrl,
    JANA_SMALL_FINANCE_BANK_CATALOG.currentOpeningsPageUrl,
  )
})

test('Jana Small Finance Bank exact backlog row matches directly from the local catalog without aliases', async () => {
  const { JANA_SMALL_FINANCE_BANK_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Jana Small Finance Bank\n',
    catalog: [JANA_SMALL_FINANCE_BANK_CATALOG],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jana Small Finance Bank', 'janasmallfinancebank', 'Jana Small Finance Bank']],
  )
})

test('getScraperCatalog includes Jana Small Finance Bank as a verified fail-closed sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'janasmallfinancebank')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Jana Small Finance Bank')
  assert.equal(provider.companyCareerPage, 'https://www.jana.bank.in/about-us/careers-hm/')
  assert.equal(provider.companyDomain, 'jana.bank.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs')
  assert.match(provider.modulePath, /janasmallfinancebank[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Jana Small Finance Bank scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'janasmallfinancebank')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'janasmallfinancebank')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs')
  assert.match(scraper.dryRunFile, /janasmallfinancebank[\\/]jobs\.json$/i)
})
