import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jadeglobal.workday/catalog.js')
  } catch {
    assert.fail('Expected Jade Global catalog module at ../../scraper/jadeglobal.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/jadeglobal.workday/script.js')
  } catch {
    assert.fail('Expected Jade Global scraper module at ../../scraper/jadeglobal.workday/script.js')
  }
}

test('Jade Global local catalog captures the verified first-party Workday contract', async () => {
  const { JADE_GLOBAL_CATALOG } = await loadCatalogModule()
  const jadeGlobal = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(JADE_GLOBAL_CATALOG)

  assert.equal(JADE_GLOBAL_CATALOG.source, 'jadeglobal')
  assert.equal(JADE_GLOBAL_CATALOG.companyName, 'Jade Global')
  assert.equal(JADE_GLOBAL_CATALOG.officialBrandName, 'Jade Global')
  assert.equal(JADE_GLOBAL_CATALOG.adapter, 'script')
  assert.equal(JADE_GLOBAL_CATALOG.modulePath, '../../scraper/jadeglobal.workday/script.js')
  assert.equal(JADE_GLOBAL_CATALOG.dryRunFile, 'jadeglobal.workday/jobs.json')
  assert.equal(JADE_GLOBAL_CATALOG.companyCareerPage, 'https://www.jadeglobal.com/careers')
  assert.equal(
    JADE_GLOBAL_CATALOG.workdayBoardUrl,
    'https://jadeglobal.wd5.myworkdayjobs.com/Jade_Careers',
  )
  assert.equal(
    JADE_GLOBAL_CATALOG.jobsApiUrl,
    'https://jadeglobal.wd5.myworkdayjobs.com/wday/cxs/jadeglobal/Jade_Careers/jobs',
  )
  assert.equal(JADE_GLOBAL_CATALOG.companyDomain, 'jadeglobal.com')
  assert.equal(JADE_GLOBAL_CATALOG.atsPlatform, 'workday')
  assert.equal(JADE_GLOBAL_CATALOG.countryFilter, 'Global')
  assert.equal(
    JADE_GLOBAL_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-workday-jobs-api',
  )
  assert.equal(
    JADE_GLOBAL_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+workday-jobs-api',
  )
  assert.equal(JADE_GLOBAL_CATALOG.parser, 'custom-script')
  assert.equal(JADE_GLOBAL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(JADE_GLOBAL_CATALOG.verifiedPublicJobCount, 261)
  assert.equal(JADE_GLOBAL_CATALOG.verifiedOn, '2026-07-16')
  assert.match(JADE_GLOBAL_CATALOG.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(JADE_GLOBAL_CATALOG.verifiedSurfaceSummary, /jadeglobal\.com\/careers/i)
  assert.match(
    JADE_GLOBAL_CATALOG.verifiedSurfaceSummary,
    /jadeglobal\.wd5\.myworkdayjobs\.com\/Jade_Careers/i,
  )
  assert.match(JADE_GLOBAL_CATALOG.verifiedSurfaceSummary, /261 live roles/i)

  assert.equal(provider.source, 'jadeglobal')
  assert.equal(provider.companyName, 'Jade Global')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jadeglobal.com/careers')
  assert.equal(provider.companyDomain, 'jadeglobal.com')
  assert.match(provider.modulePath, /jadeglobal\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /jadeglobal.workday[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Jade Global'), false)

  assert.equal(jadeGlobal.PROVIDER_METADATA.source, provider.source)
  assert.equal(jadeGlobal.CAREERS_URL, provider.companyCareerPage)
  assert.equal(jadeGlobal.WORKDAY_BOARD_URL, provider.workdayBoardUrl)
  assert.equal(jadeGlobal.JOBS_API_URL, provider.jobsApiUrl)
})

test('Jade Global exact-name backlog rows resolve directly from local metadata without shared aliases', async () => {
  const { JADE_GLOBAL_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Jade Global\n',
    catalog: [hydrateProviderCatalogEntry(JADE_GLOBAL_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jade Global', 'jadeglobal', 'Jade Global']],
  )
})

test('getScraperCatalog includes Jade Global as a verified Workday provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'jadeglobal')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Jade Global')
  assert.equal(provider.companyCareerPage, 'https://www.jadeglobal.com/careers')
  assert.equal(provider.companyDomain, 'jadeglobal.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /jadeglobal\.workday[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Jade Global scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'jadeglobal')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'jadeglobal')
  assert.equal(scraper.provider.atsPlatform, 'workday')
  assert.match(scraper.dryRunFile, /jadeglobal.workday[\\/]jobs\.json$/i)
})
