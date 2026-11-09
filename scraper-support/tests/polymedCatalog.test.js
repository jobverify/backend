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
    return await import('../../scraper/polymed/catalog.js')
  } catch {
    assert.fail('Expected Polymed catalog module at ../../scraper/polymed/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/polymed/script.js')
  } catch {
    assert.fail('Expected Polymed scraper module at ../../scraper/polymed/script.js')
  }
}

test('Polymed local catalog captures the careers-form and stale-job-opening no-public-jobs contract', async () => {
  const { POLYMED_CATALOG } = await loadCatalogModule()
  const polymed = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(POLYMED_CATALOG)

  assert.equal(POLYMED_CATALOG.source, 'polymed')
  assert.equal(POLYMED_CATALOG.companyName, 'Polymed')
  assert.equal(POLYMED_CATALOG.officialBrandName, 'Poly Medicure Limited')
  assert.equal(POLYMED_CATALOG.adapter, 'script')
  assert.equal(POLYMED_CATALOG.modulePath, '../../scraper/polymed/script.js')
  assert.equal(POLYMED_CATALOG.dryRunFile, 'polymed/jobs.json')
  assert.equal(POLYMED_CATALOG.homepageUrl, 'https://www.polymedicure.com/')
  assert.equal(POLYMED_CATALOG.companyCareerPage, 'https://www.polymedicure.com/careers/')
  assert.equal(POLYMED_CATALOG.officialJobOpeningUrl, 'https://www.polymedicure.com/job-opening/')
  assert.equal(POLYMED_CATALOG.officialCareersEmail, null)
  assert.equal(POLYMED_CATALOG.companyDomain, 'polymedicure.com')
  assert.equal(POLYMED_CATALOG.atsPlatform, 'official-company-site-careers-form-no-public-jobs-board')
  assert.equal(POLYMED_CATALOG.countryFilter, 'India')
  assert.equal(POLYMED_CATALOG.paginationStrategy, 'official-careers-page-validation-only')
  assert.equal(
    POLYMED_CATALOG.extractionStrategy,
    'verified-careers-form+stale-job-opening-page-return-empty',
  )
  assert.equal(POLYMED_CATALOG.parser, 'custom-script')
  assert.equal(POLYMED_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(POLYMED_CATALOG.verifiedOn, '2026-08-07')
  assert.equal(POLYMED_CATALOG.verifiedPublicJobCount, 0)
  assert.equal(POLYMED_CATALOG.verifiedIndiaJobCount, 0)
  assert.match(POLYMED_CATALOG.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(POLYMED_CATALOG.verifiedSurfaceSummary, /polymedicure\.com\/careers/i)
  assert.match(POLYMED_CATALOG.verifiedSurfaceSummary, /without any enumerable public job listings or explicit careers email handoff/i)
  assert.match(POLYMED_CATALOG.verifiedSurfaceSummary, /2019/i)
  assert.match(POLYMED_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Polymed'), false)

  assert.equal(provider.source, 'polymed')
  assert.equal(provider.companyName, 'Polymed')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.polymedicure.com/careers/')
  assert.equal(provider.companyDomain, 'polymedicure.com')
  assert.match(provider.modulePath, /polymed[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /polymed[\\/]jobs\.json$/i)

  assert.equal(polymed.PROVIDER_METADATA.source, provider.source)
  assert.equal(polymed.CAREERS_URL, provider.companyCareerPage)
  assert.equal(polymed.JOB_OPENING_URL, provider.officialJobOpeningUrl)
})

test('Polymed exact-name backlog rows resolve directly from local metadata without an alias', async () => {
  const { POLYMED_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Polymed\n',
    catalog: [hydrateProviderCatalogEntry(POLYMED_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Polymed', 'polymed', 'Polymed']],
  )
})

test('getScraperCatalog exposes Polymed as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'polymed')
  const scraper = buildScrapers().find((item) => item.name === 'polymed')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Polymed')
  assert.equal(provider.companyCareerPage, 'https://www.polymedicure.com/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Polymed'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Polymed\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Polymed', 'polymed', 'Polymed']],
  )
})

test('Polymed hydrated local catalog stays script-runner compatible for later central integration', async () => {
  const { POLYMED_CATALOG } = await loadCatalogModule()
  const polymed = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(POLYMED_CATALOG)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Polymed')
  assert.equal(provider.companyDomain, 'polymedicure.com')
  assert.match(provider.modulePath, /polymed[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /polymed[\\/]jobs\.json$/i)
  assert.equal(typeof polymed.run, 'function')
})
