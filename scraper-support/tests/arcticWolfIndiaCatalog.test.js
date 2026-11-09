import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/arcticwolfindia.workday/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/arcticwolfindia.workday/catalog.js')
  } catch {
    assert.fail('Expected Arctic Wolf India catalog module at ../../scraper/arcticwolfindia.workday/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/arcticwolfindia.workday/script.js')
  } catch {
    assert.fail('Expected Arctic Wolf India scraper module at ../../scraper/arcticwolfindia.workday/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Arctic Wolf India local catalog captures the verified first-party careers handoff and public Workday India facet surface', async () => {
  const { ARCTIC_WOLF_INDIA_CATALOG } = await loadCatalogModule()
  const arcticWolfIndia = await loadScraperModule()
  const provider = buildCatalogReadyProvider(ARCTIC_WOLF_INDIA_CATALOG)

  assert.equal(provider.source, 'arcticwolfindia')
  assert.equal(provider.companyName, 'Arctic Wolf India')
  assert.equal(provider.officialBrandName, 'Arctic Wolf')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://arcticwolf.com/company/careers/')
  assert.equal(provider.companyDomain, 'arcticwolf.com')
  assert.equal(provider.officialHomepageUrl, 'https://arcticwolf.com/')
  assert.equal(
    provider.officialWorkdayBoardUrl,
    'https://arcticwolf.wd1.myworkdayjobs.com/External',
  )
  assert.equal(
    provider.jobsApiUrl,
    'https://arcticwolf.wd1.myworkdayjobs.com/wday/cxs/arcticwolf/External/jobs',
  )
  assert.deepEqual(provider.verifiedIndiaLocationDescriptors, [
    'Bengaluru, IND',
    'Remote - IND - Karnataka',
  ])
  assert.equal(
    provider.verifiedIndiaJobUrl,
    'https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-Quality-Engineer-2_R26_478',
  )
  assert.equal(
    provider.verifiedIndiaApplyUrl,
    'https://arcticwolf.wd1.myworkdayjobs.com/External/job/Bengaluru-IND/Senior-Quality-Engineer-2_R26_478/apply',
  )
  assert.equal(provider.atsPlatform, 'workday')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-handoff-plus-workday-locations-facet',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+verified-workday-board+unfiltered-workday-jobs-api+india-location-facets+filtered-workday-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/arcticwolf\.com\/company\/careers\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/arcticwolf\.wd1\.myworkdayjobs\.com\/External/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/arcticwolf\.wd1\.myworkdayjobs\.com\/wday\/cxs\/arcticwolf\/External\/jobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /\b68 India roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru, IND/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote - IND - Karnataka/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior-Quality-Engineer-2_R26_478/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /arcticwolfindia.workday[\\/]jobs\.json$/i)

  assert.equal(arcticWolfIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(arcticWolfIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(arcticWolfIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(arcticWolfIndia.PROVIDER_METADATA.jobsApiUrl, provider.jobsApiUrl)
})

test('Arctic Wolf India exact backlog name matches from the local provider contract without aliases', async () => {
  const { ARCTIC_WOLF_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Arctic Wolf India\n',
    catalog: [buildCatalogReadyProvider(ARCTIC_WOLF_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arctic Wolf India', 'arcticwolfindia', 'Arctic Wolf India']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Arctic Wolf India'), false)
})

test('buildScrapers and company coverage resolve Arctic Wolf India from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'arcticwolfindia')
  const scraper = buildScrapers().find((item) => item.name === 'arcticwolfindia')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Arctic Wolf India')
  assert.equal(provider.companyCareerPage, 'https://arcticwolf.com/company/careers/')
  assert.match(scraper.dryRunFile, /arcticwolfindia.workday[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Arctic Wolf India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Arctic Wolf India', 'arcticwolfindia', 'Arctic Wolf India']],
  )
})
