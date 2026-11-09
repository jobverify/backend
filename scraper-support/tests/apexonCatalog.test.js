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
const apexonModulePath = path.resolve(currentDir, '../../scraper/apexon/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/apexon/catalog.js')
  } catch {
    assert.fail('Expected Apexon catalog module at ../../scraper/apexon/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/apexon/script.js')
  } catch {
    assert.fail('Expected Apexon scraper module at ../../scraper/apexon/script.js')
  }
}

test('Apexon local catalog captures the verified first-party careers handoff and explore-jobs surface', async () => {
  const { APEXON_CATALOG } = await loadCatalogModule()
  const apexon = await loadScriptModule()

  assert.equal(APEXON_CATALOG.source, 'apexon')
  assert.equal(APEXON_CATALOG.companyName, 'Apexon')
  assert.equal(APEXON_CATALOG.officialBrandName, 'Apexon')
  assert.equal(APEXON_CATALOG.adapter, 'script')
  assert.equal(APEXON_CATALOG.companyCareerPage, 'https://www.apexon.com/about/careers/')
  assert.equal(APEXON_CATALOG.homepageUrl, 'https://www.apexon.com/')
  assert.equal(APEXON_CATALOG.exploreJobsUrl, 'https://www.apexon.com/explore-jobs/')
  assert.equal(
    APEXON_CATALOG.sampleDetailUrl,
    'https://www.apexon.com/career-job-detail/?id=0&jobid=6500',
  )
  assert.equal(APEXON_CATALOG.companyDomain, 'apexon.com')
  assert.equal(APEXON_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(APEXON_CATALOG.countryFilter, 'India')
  assert.equal(
    APEXON_CATALOG.paginationStrategy,
    'verified-careers-page-handoff-plus-single-first-party-explore-jobs-listing',
  )
  assert.equal(
    APEXON_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+first-party-explore-jobs-table+first-party-detail-pages+talentrecruit-apply-handoff',
  )
  assert.equal(APEXON_CATALOG.parser, 'custom-script')
  assert.equal(APEXON_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(APEXON_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(APEXON_CATALOG.dryRunFile, 'apexon/jobs.json')
  assert.equal(APEXON_CATALOG.modulePath, apexonModulePath)
  assert.match(APEXON_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apexon\.com\/about\/careers\//i)
  assert.match(APEXON_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.apexon\.com\/explore-jobs\//i)
  assert.match(APEXON_CATALOG.verifiedSurfaceSummary, /career-job-detail\/\?id=0&jobid=6500/i)
  assert.match(APEXON_CATALOG.verifiedSurfaceSummary, /talentrecruit/i)
  assert.match(APEXON_CATALOG.verifiedSurfaceSummary, /31 India job rows/i)

  assert.equal(apexon.PROVIDER_METADATA.source, APEXON_CATALOG.source)
  assert.equal(apexon.PROVIDER_METADATA.companyName, APEXON_CATALOG.companyName)
  assert.equal(apexon.PROVIDER_METADATA.exploreJobsUrl, APEXON_CATALOG.exploreJobsUrl)
})

test('Apexon local catalog hydrates into coverage without needing an alias entry', async () => {
  const { APEXON_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APEXON_CATALOG)

  assert.equal(provider.companyName, 'Apexon')
  assert.equal(provider.companyDomain, 'apexon.com')
  assert.match(provider.modulePath, /apexon[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /apexon[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apexon\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apexon', 'apexon', 'Apexon']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Apexon'), false)
})

test('buildScrapers and company coverage resolve Apexon from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'apexon')
  const scraper = buildScrapers().find((item) => item.name === 'apexon')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Apexon')
  assert.equal(provider.companyCareerPage, 'https://www.apexon.com/about/careers/')
  assert.match(scraper.dryRunFile, /apexon[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Apexon\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Apexon', 'apexon', 'Apexon']],
  )
})
