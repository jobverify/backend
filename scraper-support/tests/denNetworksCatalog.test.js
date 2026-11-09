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
const modulePath = path.resolve(currentDir, '../../scraper/dennetworks/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dennetworks/catalog.js')
  } catch {
    assert.fail('Expected Den Networks catalog module at ../../scraper/dennetworks/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Den Networks local catalog captures the verified first-party careers hub and linked live opening surface without alias churn', async () => {
  const {
    DEN_NETWORKS_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(DEN_NETWORKS_CATALOG)

  assert.equal(defaultCatalog, DEN_NETWORKS_CATALOG)
  assert.equal(provider.source, 'dennetworks')
  assert.equal(provider.companyName, 'Den Networks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://dennetworks.com/careers')
  assert.equal(provider.homepageUrl, 'https://dennetworks.com/')
  assert.equal(provider.careerDetailBaseUrl, 'https://dennetworks.com/home/career_detail/')
  assert.equal(provider.sampleOpeningUrl, 'https://dennetworks.com/home/career_detail/3')
  assert.equal(provider.applyFormActionUrl, 'https://dennetworks.com/home/upload_resume')
  assert.equal(provider.companyDomain, 'dennetworks.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-pages-plus-upload-resume-form')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'careers-root-plus-linked-career-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-root+linked-first-party-career-detail-pages+resume-upload-form-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /dennetworks[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dennetworks\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dennetworks\.com\/home\/career_detail\/3/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/dennetworks\.com\/home\/upload_resume/i)
  assert.match(provider.verifiedSurfaceSummary, /Corporate Communication/i)
  assert.match(provider.verifiedSurfaceSummary, /August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Thirteen of the 14/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Den Networks'), false)
})

test('Den Networks backlog row matches directly from the local provider metadata without an alias entry', async () => {
  const { DEN_NETWORKS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Den Networks\n',
    catalog: [buildCatalogReadyProvider(DEN_NETWORKS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Den Networks', 'dennetworks', 'Den Networks']],
  )
})

test('buildScrapers and company coverage resolve Den Networks from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dennetworks')
  const scraper = buildScrapers().find((item) => item.name === 'dennetworks')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Den Networks')
  assert.equal(provider.companyCareerPage, 'https://dennetworks.com/careers')
  assert.match(scraper.dryRunFile, /dennetworks[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Den Networks\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Den Networks', 'dennetworks', 'Den Networks']],
  )
})
