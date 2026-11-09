import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/saucelabs/script.js')

const LOCAL_ALIAS_MAP = {
  'Sauce Labs India': 'saucelabs',
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/saucelabs/catalog.js')
  } catch {
    assert.fail('Expected Sauce Labs catalog module at ../../scraper/saucelabs/catalog.js')
  }
}

test('Sauce Labs local catalog captures the verified first-party careers page and Greenhouse board contract', async () => {
  const { SAUCE_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAUCE_LABS_CATALOG)

  assert.equal(defaultCatalog, SAUCE_LABS_CATALOG)
  assert.equal(provider.source, 'saucelabs')
  assert.equal(provider.companyName, 'Sauce Labs')
  assert.equal(provider.officialBrandName, 'Sauce Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://saucelabs.com/')
  assert.equal(provider.companyCareerPage, 'https://saucelabs.com/careers')
  assert.equal(provider.officialCareersDetailUrlBase, 'https://saucelabs.com/company/careers/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/saucelabs')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/saucelabs/jobs?content=true',
  )
  assert.equal(provider.companyDomain, 'saucelabs.com')
  assert.equal(provider.verifiedPublicRoleCount, 17)
  assert.equal(provider.verifiedIndiaRoleCount, 11)
  assert.equal(provider.verifiedSampleFirstPartyJobUrl, 'https://saucelabs.com/company/careers/7096532')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+browser-confirmed-greenhouse-request+greenhouse-jobs-api+india-location-filter+first-party-detail-url-pattern',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/saucelabs\.com\/careers/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/saucelabs\/jobs\?content=true/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b17 public roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b11 India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /National Capital Region, New Delhi/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /saucelabs[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sauce Labs'), false)
  assert.equal(companyAliases['Sauce Labs India'], 'saucelabs')
})

test('Sauce Labs exact backlog row matches directly from the local catalog without shared aliases', async () => {
  const { SAUCE_LABS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Sauce Labs\n',
    catalog: [hydrateProviderCatalogEntry(SAUCE_LABS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sauce Labs', 'saucelabs', 'Sauce Labs']],
  )
})

test('Sauce Labs India is covered by the same provider when the planned alias is supplied at integration time', async () => {
  const { SAUCE_LABS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Sauce Labs\nSauce Labs India\n',
    catalog: [hydrateProviderCatalogEntry(SAUCE_LABS_CATALOG)],
    aliasMap: LOCAL_ALIAS_MAP,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Sauce Labs', 'saucelabs', 'Sauce Labs'],
      ['Sauce Labs India', 'saucelabs', 'Sauce Labs'],
    ],
  )
})

test('Sauce Labs hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SAUCE_LABS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAUCE_LABS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Sauce Labs')
  assert.equal(provider.companyCareerPage, 'https://saucelabs.com/careers')
  assert.equal(provider.companyDomain, 'saucelabs.com')
  assert.match(provider.modulePath, /saucelabs[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /saucelabs[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
