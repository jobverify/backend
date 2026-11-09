import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const providerDir = path.resolve(currentDir, '../../scraper/telstra.workday')
const modulePath = path.resolve(providerDir, 'script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/telstra.workday/catalog.js')
  } catch {
    assert.fail('Expected Telstra catalog module at ../../scraper/telstra.workday/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/telstra.workday/script.js')
  } catch {
    assert.fail('Expected Telstra scraper module at ../../scraper/telstra.workday/script.js')
  }
}

test('Telstra local catalog captures the verified first-party careers handoff and Workday jobs API surface', async () => {
  const { TELSTRA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const telstra = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TELSTRA_CATALOG)
  const config = loadConfig(providerDir)

  assert.equal(defaultCatalog, TELSTRA_CATALOG)
  assert.equal(provider.source, 'telstra')
  assert.equal(provider.companyName, 'Telstra')
  assert.equal(provider.officialBrandName, 'Telstra')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.telstra.com.au/careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.telstra.com.au/careers')
  assert.equal(provider.officialWorkdayBoardUrl, 'https://telstra.wd3.myworkdayjobs.com/Telstra_Careers')
  assert.equal(
    provider.jobsApiUrl,
    'https://telstra.wd3.myworkdayjobs.com/wday/cxs/telstra/Telstra_Careers/jobs',
  )
  assert.equal(provider.companyDomain, 'telstra.com.au')
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-jobs-api-country-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-workday-handoff+workday-jobs-api+india-country-facet',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.match(provider.dryRunFile, /telstra.workday[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.telstra\.com\.au\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/telstra\.wd3\.myworkdayjobs\.com\/Telstra_Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /wday\/cxs\/telstra\/Telstra_Careers\/jobs/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /Customer Service Consultant - International Voice Process/i,
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Telstra'), false)

  assert.equal(config.listingStrategy, 'jobs-api')
  assert.equal(
    config.jobsApiUrl,
    'https://telstra.wd3.myworkdayjobs.com/wday/cxs/telstra/Telstra_Careers/jobs',
  )
  assert.equal(
    config.detailUrlBase,
    'https://telstra.wd3.myworkdayjobs.com/en-US/Telstra_Careers',
  )

  assert.equal(telstra.PROVIDER_METADATA.source, TELSTRA_CATALOG.source)
  assert.equal(telstra.PROVIDER_METADATA.companyName, TELSTRA_CATALOG.companyName)
  assert.equal(
    telstra.PROVIDER_METADATA.officialWorkdayBoardUrl,
    TELSTRA_CATALOG.officialWorkdayBoardUrl,
  )
})

test('Telstra exact backlog row matches directly from local provider metadata', async () => {
  const { TELSTRA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Telstra\n',
    catalog: [hydrateProviderCatalogEntry(TELSTRA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Telstra', 'telstra', 'Telstra']],
  )
})

test('Telstra hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { TELSTRA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TELSTRA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Telstra')
  assert.equal(provider.companyCareerPage, 'https://www.telstra.com.au/careers')
  assert.equal(provider.companyDomain, 'telstra.com.au')
  assert.equal(provider.atsPlatform, 'workday')
  assert.match(provider.modulePath, /telstra\.workday[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /telstra.workday[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
