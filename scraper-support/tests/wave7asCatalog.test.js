import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalogModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected catalog module at ${relativePath}`)
  }
}

const assertBacklogRowMatches = ({ provider, companyName, modulePath }) => {
  const report = generateCompanyCoverageReport({
    csvText: `${companyName}\n`,
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(provider.modulePath, modulePath)
}

test('Techtree It Systems local catalog records blocked inventory and partial wp-job-openings scope', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/techtreeitsystems/script.js')
  const {
    TECHTREE_IT_SYSTEMS_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/techtreeitsystems/catalog.js')
  const provider = hydrateProviderCatalogEntry(TECHTREE_IT_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, TECHTREE_IT_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'techtreeitsystems')
  assert.equal(provider.companyName, 'Techtree It Systems')
  assert.equal(provider.officialBrandName, 'TechTree IT System Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.techtreeit.com/')
  assert.equal(provider.companyCareerPage, 'https://www.techtreeit.com/careers/')
  assert.equal(provider.companyDomain, 'techtreeit.com')
  assert.equal(provider.atsPlatform, 'wp-job-openings')
  assert.equal(provider.paginationStrategy, 'partial-inline-first-party-awsm-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'http-200-first-party-careers+inline-awsm-cards+validated-native-detail-publication|blocked-and-detail-errors-fail-closed',
  )
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /You are being redirected\.\.\./i)
  assert.match(provider.verifiedSurfaceSummary, /inline wp-job-openings cards/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Techtree It Systems',
    modulePath,
  })
})

test('Rocket Software local catalog captures the Cloudflare-gated careers handoff and current public Workday contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/rocketsoftware/script.js')
  const {
    ROCKET_SOFTWARE_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/rocketsoftware/catalog.js')
  const provider = hydrateProviderCatalogEntry(ROCKET_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, ROCKET_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'rocketsoftware')
  assert.equal(provider.companyName, 'Rocket Software')
  assert.equal(provider.officialBrandName, 'Rocket Software')
  assert.equal(provider.homepageUrl, 'https://www.rocketsoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://www.rocketsoftware.com/en-us/careers')
  assert.equal(provider.workdayBoardUrl, 'https://rocket.wd5.myworkdayjobs.com/rocket_careers')
  assert.equal(provider.companyDomain, 'rocketsoftware.com')
  assert.equal(provider.atsPlatform, 'official-careers-workday-handoff')
  assert.equal(
    provider.paginationStrategy,
    'first-party-careers-page-plus-public-workday-jobs-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page-or-known-cloudflare-gate+public-workday-jobs-api+india-detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare challenge/i)
  assert.match(provider.verifiedSurfaceSummary, /2 India postings/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer III/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Accounts Receivable Specialist/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Rocket Software',
    modulePath,
  })
})

test('HIREXA SOLUTIONS local catalog captures the verified placeholder-only careers page contract', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/hirexasolutions/script.js')
  const {
    HIREXA_SOLUTIONS_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/hirexasolutions/catalog.js')
  const provider = hydrateProviderCatalogEntry(HIREXA_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, HIREXA_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'hirexasolutions')
  assert.equal(provider.companyName, 'HIREXA SOLUTIONS')
  assert.equal(provider.officialBrandName, 'Hirexa')
  assert.equal(provider.homepageUrl, 'https://hirexa.com/')
  assert.equal(provider.companyCareerPage, 'https://hirexa.com/careers/')
  assert.equal(provider.companyDomain, 'hirexa.com')
  assert.equal(provider.atsPlatform, 'official-careers-placeholder-cards')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-search-job-shell+repeated-placeholder-netcraft-cards+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Search Job/i)
  assert.match(provider.verifiedSurfaceSummary, /NetCraft/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'HIREXA SOLUTIONS',
    modulePath,
  })
})

test('Northcorp Software local catalog captures the verified first-party inline openings page', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/northcorpsoftware/script.js')
  const {
    NORTHCORP_SOFTWARE_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/northcorpsoftware/catalog.js')
  const provider = hydrateProviderCatalogEntry(NORTHCORP_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, NORTHCORP_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'northcorpsoftware')
  assert.equal(provider.companyName, 'Northcorp Software')
  assert.equal(provider.officialBrandName, 'Northcorp Software')
  assert.equal(provider.homepageUrl, 'https://northcorpsoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://northcorpsoftware.com/career.html')
  assert.equal(provider.companyDomain, 'northcorpsoftware.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-inline-openings')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-inline-openings-table+verified-accordion-role-details+single-apply-form',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Creative & Technical Content Writer/i)
  assert.match(provider.verifiedSurfaceSummary, /DevOps Engineer/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Northcorp Software',
    modulePath,
  })
})

test('Maxgen Technologies local catalog captures the verified contradictory no-jobs careers shell sentinel', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/maxgentechnologies/script.js')
  const {
    MAXGEN_TECHNOLOGIES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule('../../scraper/maxgentechnologies/catalog.js')
  const provider = hydrateProviderCatalogEntry(MAXGEN_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, MAXGEN_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'maxgentechnologies')
  assert.equal(provider.companyName, 'Maxgen Technologies')
  assert.equal(provider.officialBrandName, 'Maxgen Technologies Pvt Ltd')
  assert.equal(provider.homepageUrl, 'https://www.maxgentechnologies.com/')
  assert.equal(provider.companyCareerPage, 'https://www.maxgentechnologies.com/career')
  assert.equal(provider.companyDomain, 'maxgentechnologies.com')
  assert.equal(provider.atsPlatform, 'official-careers-no-jobs-shell-with-unlinked-detail-pages')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-no-jobs-shell+unlinked-detail-pages-not-trusted+fail-closed-sentinel',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /No jobs available\./i)
  assert.match(provider.verifiedSurfaceSummary, /Python Developer with 0-1 year of experience/i)

  assertBacklogRowMatches({
    provider,
    companyName: 'Maxgen Technologies',
    modulePath,
  })
})
