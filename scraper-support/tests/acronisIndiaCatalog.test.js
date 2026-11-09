import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/acronisindia.workday/provider.js')
  } catch {
    return null
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/acronisindia.workday/script.js')
  } catch {
    return null
  }
}

test('Acronis India exports local provider metadata for the verified Acronis first-party careers and embedded Workday jobs surface', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.ok(
    providerModule,
    'Expected Acronis India provider module at ../../scraper/acronisindia.workday/provider.js',
  )
  assert.ok(
    scriptModule,
    'Expected Acronis India scraper module at ../../scraper/acronisindia.workday/script.js',
  )

  assert.deepEqual(providerModule.provider, {
    source: 'acronisindia',
    companyName: 'Acronis India',
    officialBrandName: 'Acronis',
    adapter: 'script',
    modulePath: '../../scraper/acronisindia.workday/script.js',
    companyCareerPage: 'https://www.acronis.com/en/careers/',
    officialCareersHandoffUrl: 'https://www.acronis.com/en/careers/jobs/',
    workdayDetailBaseUrl: 'https://acronis.wd502.myworkdayjobs.com/acronis_careers/',
    atsPlatform: 'workday',
    countryFilter: 'India',
    paginationStrategy: 'verified-first-party-careers-page-plus-first-party-jobs-page-embedded-workday-items',
    extractionStrategy:
      'verified-official-careers-page+verified-first-party-jobs-page+embedded-workday-items',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'acronis.com',
    verifiedOn: '2026-07-14',
    verifiedSurfaceSummary:
      'Verified https://www.acronis.com/en/careers/ and https://www.acronis.com/en/careers/jobs/ on July 14, 2026. The official Acronis careers landing links to the first-party jobs page, and that jobs page exposes public embedded Workday job records with detail URLs on https://acronis.wd502.myworkdayjobs.com/acronis_careers/, including an India - Remote opening.',
    dryRunFile: 'acronisindia.workday/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.OFFICIAL_BRAND_NAME, providerModule.provider.officialBrandName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.JOBS_URL, providerModule.provider.officialCareersHandoffUrl)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Acronis India local provider contract hydrates into coverage without requiring an alias', async () => {
  const providerModule = await loadProviderModule()
  assert.ok(providerModule)

  const hydratedProvider = hydrateProviderCatalogEntry(providerModule.provider)

  assert.equal(hydratedProvider.companyName, 'Acronis India')
  assert.equal(hydratedProvider.companyDomain, 'acronis.com')
  assert.match(hydratedProvider.modulePath, /acronisindia\.workday[\\/]script\.js$/i)
  assert.match(hydratedProvider.dryRunFile, /acronisindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Acronis India\n',
    catalog: [hydratedProvider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Acronis India', 'acronisindia', 'Acronis India']],
  )
})

test('buildScrapers and company coverage resolve Acronis India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'acronisindia')
  const scraper = buildScrapers().find((item) => item.name === 'acronisindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Acronis India')
  assert.equal(provider.companyCareerPage, 'https://www.acronis.com/en/careers/')
  assert.match(scraper.dryRunFile, /acronisindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Acronis India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Acronis India', 'acronisindia', 'Acronis India']],
  )
})
