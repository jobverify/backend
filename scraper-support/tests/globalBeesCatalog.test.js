import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const globalBeesModulePath = path.resolve(currentDir, '../../scraper/globalbees/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/globalbees/catalog.js')
  } catch {
    assert.fail('Expected GlobalBees catalog module at ../../scraper/globalbees/catalog.js')
  }
}

const loadGlobalBeesModule = async () => {
  try {
    return await import('../../scraper/globalbees/script.js')
  } catch {
    assert.fail('Expected GlobalBees scraper module at ../../scraper/globalbees/script.js')
  }
}

test('GlobalBees local catalog captures the verified first-party contact-form-only careers surface', async () => {
  const { GLOBALBEES_CATALOG } = await loadCatalogModule()
  const globalBees = await loadGlobalBeesModule()

  assert.equal(GLOBALBEES_CATALOG.source, 'globalbees')
  assert.equal(GLOBALBEES_CATALOG.companyName, 'GlobalBees')
  assert.equal(GLOBALBEES_CATALOG.officialBrandName, 'GlobalBees')
  assert.equal(GLOBALBEES_CATALOG.adapter, 'script')
  assert.equal(GLOBALBEES_CATALOG.companyCareerPage, 'https://www.globalbees.com/career.html')
  assert.equal(GLOBALBEES_CATALOG.companyDomain, 'globalbees.com')
  assert.equal(GLOBALBEES_CATALOG.homepageUrl, 'https://www.globalbees.com/')
  assert.equal(GLOBALBEES_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(GLOBALBEES_CATALOG.countryFilter, 'India')
  assert.equal(GLOBALBEES_CATALOG.paginationStrategy, 'homepage-plus-career-page-validation')
  assert.equal(
    GLOBALBEES_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-contact-form+no-trustworthy-public-job-records-return-empty',
  )
  assert.equal(GLOBALBEES_CATALOG.parser, 'custom-script')
  assert.equal(GLOBALBEES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(GLOBALBEES_CATALOG.verifiedOn, '2026-07-16')
  assert.match(GLOBALBEES_CATALOG.verifiedSurfaceSummary, /career\.html/i)
  assert.match(GLOBALBEES_CATALOG.verifiedSurfaceSummary, /careers@globalbees\.com/i)
  assert.match(GLOBALBEES_CATALOG.verifiedSurfaceSummary, /no trustworthy public job listings/i)
  assert.equal(GLOBALBEES_CATALOG.modulePath, globalBeesModulePath)

  assert.equal(globalBees.PROVIDER_METADATA.source, GLOBALBEES_CATALOG.source)
  assert.equal(globalBees.PROVIDER_METADATA.companyName, GLOBALBEES_CATALOG.companyName)
  assert.equal(globalBees.PROVIDER_METADATA.companyCareerPage, GLOBALBEES_CATALOG.companyCareerPage)
  assert.equal(globalBees.PROVIDER_METADATA.homepageUrl, GLOBALBEES_CATALOG.homepageUrl)
})

test('GlobalBees exact backlog row resolves directly from the local provider metadata without aliases', async () => {
  const { GLOBALBEES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GlobalBees\n',
    catalog: [GLOBALBEES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GlobalBees', 'globalbees', 'GlobalBees']],
  )
})

test('getScraperCatalog includes GlobalBees as a verified no-public-jobs provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'globalbees')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GlobalBees')
  assert.equal(provider.companyCareerPage, 'https://www.globalbees.com/career.html')
  assert.equal(provider.companyDomain, 'globalbees.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /globalbees[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GlobalBees scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'globalbees')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'globalbees')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(scraper.dryRunFile, /globalbees[\\/]jobs\.json$/i)
})
