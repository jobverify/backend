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
    return await import('../../scraper/polaris.workday/catalog.js')
  } catch {
    assert.fail('Expected Polaris catalog module at ../../scraper/polaris.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/polaris.workday/script.js')
  } catch {
    assert.fail('Expected Polaris scraper module at ../../scraper/polaris.workday/script.js')
  }
}

test('Polaris local catalog captures the verified first-party careers shell and public Workday board contract', async () => {
  const { POLARIS_CATALOG } = await loadCatalogModule()
  const polaris = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(POLARIS_CATALOG)

  assert.equal(POLARIS_CATALOG.source, 'polaris')
  assert.equal(POLARIS_CATALOG.companyName, 'Polaris')
  assert.equal(POLARIS_CATALOG.officialBrandName, 'Polaris Inc.')
  assert.equal(POLARIS_CATALOG.adapter, 'script')
  assert.equal(POLARIS_CATALOG.modulePath, '../../scraper/polaris.workday/script.js')
  assert.equal(POLARIS_CATALOG.dryRunFile, 'polaris.workday/jobs.json')
  assert.equal(POLARIS_CATALOG.companyCareerPage, 'https://www.polaris.com/en-us/careers/')
  assert.equal(
    POLARIS_CATALOG.officialJobCategoriesUrl,
    'https://www.polaris.com/en-us/careers/job-categories/all/',
  )
  assert.equal(POLARIS_CATALOG.officialLocationsUrl, 'https://www.polaris.com/en-us/locations/')
  assert.equal(
    POLARIS_CATALOG.officialIndiaLocationUrl,
    'https://www.polaris.com/en-us/locations/bangalore-india/',
  )
  assert.equal(POLARIS_CATALOG.workdayBoardUrl, 'https://polaris.wd5.myworkdayjobs.com/PolarisJobs')
  assert.equal(
    POLARIS_CATALOG.verifiedFirstPartyIndiaJobUrl,
    'https://www.polaris.com/en-us/careers/job-categories/all/apply/r30215/',
  )
  assert.equal(
    POLARIS_CATALOG.verifiedWorkdayIndiaJobUrl,
    'https://polaris.wd5.myworkdayjobs.com/en-US/PolarisJobs/job/Bangalore-India/Senior-Software-Engineer_R28999',
  )
  assert.equal(
    POLARIS_CATALOG.verifiedWorkdayIndiaApplyUrl,
    'https://polaris.wd5.myworkdayjobs.com/en-US/PolarisJobs/job/Bangalore-India/Senior-Software-Engineer_R28999/apply',
  )
  assert.equal(POLARIS_CATALOG.companyDomain, 'polaris.com')
  assert.equal(POLARIS_CATALOG.atsPlatform, 'workday')
  assert.equal(POLARIS_CATALOG.countryFilter, 'India')
  assert.equal(
    POLARIS_CATALOG.paginationStrategy,
    'verified-first-party-careers-shell-plus-public-workday-board',
  )
  assert.equal(
    POLARIS_CATALOG.extractionStrategy,
    'verified-first-party-careers-pages+cloudflare-aware-shell-validation+shared-workday-dom-scraper',
  )
  assert.equal(POLARIS_CATALOG.parser, 'custom-script')
  assert.equal(POLARIS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(POLARIS_CATALOG.verifiedIndiaLocationCountryId, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(POLARIS_CATALOG.verifiedOn, '2026-07-17')
  assert.match(POLARIS_CATALOG.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(POLARIS_CATALOG.verifiedSurfaceSummary, /polaris\.com\/en-us\/careers/i)
  assert.match(POLARIS_CATALOG.verifiedSurfaceSummary, /cloudflare/i)
  assert.match(POLARIS_CATALOG.verifiedSurfaceSummary, /polaris\.wd5\.myworkdayjobs\.com\/PolarisJobs/i)
  assert.match(POLARIS_CATALOG.verifiedSurfaceSummary, /Bangalore/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Polaris'), false)

  assert.equal(provider.source, 'polaris')
  assert.equal(provider.companyName, 'Polaris')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.polaris.com/en-us/careers/')
  assert.equal(provider.companyDomain, 'polaris.com')
  assert.match(provider.modulePath, /polaris\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /polaris.workday[\\/]jobs\.json$/i)

  assert.equal(polaris.PROVIDER_METADATA.source, provider.source)
  assert.equal(polaris.CAREERS_URL, provider.companyCareerPage)
  assert.equal(polaris.WORKDAY_BOARD_URL, provider.workdayBoardUrl)
})

test('Polaris exact-name backlog rows resolve directly from local metadata without an alias', async () => {
  const { POLARIS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Polaris\n',
    catalog: [hydrateProviderCatalogEntry(POLARIS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Polaris', 'polaris', 'Polaris']],
  )
})

test('getScraperCatalog exposes Polaris as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'polaris')
  const scraper = buildScrapers().find((item) => item.name === 'polaris')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Polaris')
  assert.equal(provider.companyCareerPage, 'https://www.polaris.com/en-us/careers/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Polaris'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Polaris\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Polaris', 'polaris', 'Polaris']],
  )
})

test('Polaris hydrated local catalog stays script-runner compatible for later central integration', async () => {
  const { POLARIS_CATALOG } = await loadCatalogModule()
  const polaris = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(POLARIS_CATALOG)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Polaris')
  assert.equal(provider.companyDomain, 'polaris.com')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /polaris\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /polaris.workday[\\/]jobs\.json$/i)
  assert.equal(typeof polaris.run, 'function')
})
