import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/niceindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/niceindia/catalog.js')
  } catch {
    assert.fail('Expected NICE India catalog module at ../../scraper/niceindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/niceindia/script.js')
  } catch {
    assert.fail('Expected NICE India scraper module at ../../scraper/niceindia/script.js')
  }
}

test('NICE India local catalog captures the verified first-party careers page and Greenhouse jobs contract', async () => {
  const { NICE_INDIA_CATALOG } = await loadCatalogModule()
  const niceIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(NICE_INDIA_CATALOG)

  assert.equal(provider.source, 'niceindia')
  assert.equal(provider.companyName, 'NICE India')
  assert.equal(provider.officialBrandName, 'NiCE')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.nice.com/')
  assert.equal(provider.companyCareerPage, 'https://www.nice.com/careers/apply?location=India+-+Pune')
  assert.equal(provider.officialCareersLandingUrl, 'https://www.nice.com/careers/apply')
  assert.equal(provider.companyDomain, 'nice.com')
  assert.equal(provider.greenhouseBoardUrl, 'https://boards.eu.greenhouse.io/nice')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/nice/jobs')
  assert.equal(provider.verifiedPublicJobCount, 327)
  assert.equal(provider.verifiedIndiaJobCount, 45)
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://boards.eu.greenhouse.io/nice/jobs/4861487101?gh_jid=4861487101',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-greenhouse-job-links+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /niceindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.nice\.com\/careers\/apply/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/nice\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /45 India jobs/i)

  assert.equal(niceIndia.PROVIDER_METADATA.source, NICE_INDIA_CATALOG.source)
  assert.equal(niceIndia.PROVIDER_METADATA.companyName, NICE_INDIA_CATALOG.companyName)
  assert.equal(
    niceIndia.PROVIDER_METADATA.companyCareerPage,
    NICE_INDIA_CATALOG.companyCareerPage,
  )
})

test('NICE India exact backlog row resolves directly from local provider metadata', async () => {
  const { NICE_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NICE India\n',
    catalog: [hydrateProviderCatalogEntry(NICE_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NICE India', 'niceindia', 'NICE India']],
  )
})

test('NICE India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { NICE_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NICE_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'NICE India')
  assert.equal(provider.companyCareerPage, 'https://www.nice.com/careers/apply?location=India+-+Pune')
  assert.equal(provider.companyDomain, 'nice.com')
  assert.match(provider.modulePath, /niceindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /niceindia[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('getScraperCatalog exposes NICE India as a runnable shared provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'niceindia')
  const scraper = buildScrapers().find((item) => item.name === 'niceindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'NICE India')
  assert.equal(provider.companyCareerPage, 'https://www.nice.com/careers/apply?location=India+-+Pune')

  const report = generateCompanyCoverageReport({
    csvText: 'NICE India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NICE India', 'niceindia', 'NICE India']],
  )
})
