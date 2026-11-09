import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dunnhumbyIndiaModulePath = path.resolve(currentDir, '../../scraper/dunnhumbyindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dunnhumbyindia/catalog.js')
  } catch {
    assert.fail('Expected Dunnhumby India catalog module at ../../scraper/dunnhumbyindia/catalog.js')
  }
}

const loadDunnhumbyIndiaModule = async () => {
  try {
    return await import('../../scraper/dunnhumbyindia/script.js')
  } catch {
    assert.fail('Expected Dunnhumby India scraper module at ../../scraper/dunnhumbyindia/script.js')
  }
}

test('Dunnhumby India local catalog captures the verified first-party careers pages and Greenhouse India jobs surface', async () => {
  const { DUNNHUMBY_INDIA_CATALOG } = await loadCatalogModule()
  const dunnhumbyIndia = await loadDunnhumbyIndiaModule()
  const provider = hydrateProviderCatalogEntry(DUNNHUMBY_INDIA_CATALOG)

  assert.equal(provider.source, 'dunnhumbyindia')
  assert.equal(provider.companyName, 'Dunnhumby India')
  assert.equal(provider.officialBrandName, 'dunnhumby')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.dunnhumby.com/')
  assert.equal(provider.companyCareerPage, 'https://www.dunnhumby.com/work-with-us/')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.dunnhumby.com/careers/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/dunnhumby')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/dunnhumby/jobs')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+verified-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'dunnhumby.com')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.dryRunFile, /dunnhumbyindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dunnhumby\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.dunnhumby\.com\/work-with-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/dunnhumby/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/dunnhumby\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Applied Data Scientist/i)
  assert.match(provider.verifiedSurfaceSummary, /Applied Data Scientist/i)
  assert.match(provider.modulePath, /dunnhumbyindia[\\/]script\.js$/i)
  assert.equal(provider.modulePath, dunnhumbyIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dunnhumby India'), false)

  assert.equal(dunnhumbyIndia.PROVIDER_METADATA.source, DUNNHUMBY_INDIA_CATALOG.source)
  assert.equal(dunnhumbyIndia.PROVIDER_METADATA.companyName, DUNNHUMBY_INDIA_CATALOG.companyName)
  assert.equal(
    dunnhumbyIndia.PROVIDER_METADATA.greenhouseBoardUrl,
    DUNNHUMBY_INDIA_CATALOG.greenhouseBoardUrl,
  )
  assert.equal(
    dunnhumbyIndia.PROVIDER_METADATA.greenhouseJobsApiUrl,
    DUNNHUMBY_INDIA_CATALOG.greenhouseJobsApiUrl,
  )
})

test('Dunnhumby India backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { DUNNHUMBY_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Dunnhumby India\n',
    catalog: [hydrateProviderCatalogEntry(DUNNHUMBY_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dunnhumby India', 'dunnhumbyindia', 'Dunnhumby India']],
  )
})
