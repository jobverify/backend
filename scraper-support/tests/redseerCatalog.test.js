import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/redseer/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/redseer/catalog.js')
  } catch {
    assert.fail('Expected Redseer catalog module at ../../scraper/redseer/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/redseer/script.js')
  } catch {
    assert.fail('Expected Redseer scraper module at ../../scraper/redseer/script.js')
  }
}

test('Redseer local catalog captures the verified first-party empty careers archive surface without alias churn', async () => {
  const { REDSEER_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const redseer = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(REDSEER_CATALOG)

  assert.equal(defaultCatalog, REDSEER_CATALOG)
  assert.equal(provider.source, 'redseer')
  assert.equal(provider.companyName, 'Redseer')
  assert.equal(provider.officialBrandName, 'RedSeer')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://redseer.com/')
  assert.equal(provider.companyCareerPage, 'https://redseer.com/careers/')
  assert.equal(provider.publicJobsArchiveUrl, 'https://redseer.com/jobopenings/')
  assert.equal(provider.emptyJobsFeedUrl, 'https://redseer.com/jobopenings/feed/')
  assert.equal(provider.emptyJobsApiUrl, 'https://redseer.com/wp-json/wp/v2/jobopenings?per_page=100')
  assert.equal(provider.companyDomain, 'redseer.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-empty-job-archive-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-empty-job-archive+verified-empty-job-feed+verified-empty-job-rest-endpoint-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /redseer[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/redseer\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/redseer\.com\/jobopenings\//i)
  assert.match(provider.verifiedSurfaceSummary, /wp-json\/wp\/v2\/jobopenings\?per_page=100/i)
  assert.match(provider.verifiedSurfaceSummary, /no current public job listings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Redseer'), false)

  assert.equal(redseer.PROVIDER_METADATA.source, REDSEER_CATALOG.source)
  assert.equal(redseer.PROVIDER_METADATA.companyName, REDSEER_CATALOG.companyName)
  assert.equal(redseer.PROVIDER_METADATA.publicJobsArchiveUrl, REDSEER_CATALOG.publicJobsArchiveUrl)
})

test('Redseer backlog row matches directly from the local catalog without alias churn', async () => {
  const { REDSEER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Redseer\n',
    catalog: [hydrateProviderCatalogEntry(REDSEER_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Redseer', 'redseer', 'Redseer']],
  )
})

test('Redseer hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { REDSEER_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(REDSEER_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Redseer')
  assert.equal(provider.companyCareerPage, 'https://redseer.com/careers/')
  assert.equal(provider.companyDomain, 'redseer.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.match(provider.modulePath, /redseer[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /redseer[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
