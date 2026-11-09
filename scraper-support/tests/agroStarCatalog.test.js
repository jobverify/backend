import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/agrostar/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/agrostar/catalog.js')
  } catch {
    assert.fail('Expected AgroStar catalog module at ../../scraper/agrostar/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/agrostar/script.js')
  } catch {
    assert.fail('Expected AgroStar scraper module at ../../scraper/agrostar/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('AgroStar local catalog captures the verified first-party Darwinbox careers surface', async () => {
  const { AGROSTAR_CATALOG } = await loadCatalogModule()
  const agroStar = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AGROSTAR_CATALOG)

  assert.equal(provider.source, 'agrostar')
  assert.equal(provider.companyName, 'AgroStar')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://corporate.agrostar.in/join-us')
  assert.equal(provider.companyDomain, 'corporate.agrostar.in')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-join-us-page-plus-darwinbox-jobs-portal')
  assert.equal(
    provider.extractionStrategy,
    'verified-join-us-page+darwinbox-public-jobs-portal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.homepageUrl, 'https://agrostar.in/')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://agrostar.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(provider.darwinboxOrigin, 'https://agrostar.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/agrostar\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.agrostar\.in\/join-us/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/agrostar\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /darwinbox/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /agrostar[\\/]jobs\.json$/i)

  assert.equal(agroStar.PROVIDER_METADATA.source, provider.source)
  assert.equal(agroStar.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(agroStar.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(
    agroStar.PROVIDER_METADATA.officialCareersHandoffUrl,
    provider.officialCareersHandoffUrl,
  )
  assert.equal(agroStar.PROVIDER_METADATA.darwinboxOrigin, provider.darwinboxOrigin)
})

test('AgroStar exact backlog name matches from the local provider contract without aliases', async () => {
  const { AGROSTAR_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AgroStar\n',
    catalog: [buildCatalogReadyProvider(AGROSTAR_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AgroStar', 'agrostar', 'AgroStar']],
  )
})

test('buildScrapers and company coverage resolve AgroStar from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agrostar')
  const scraper = buildScrapers().find((item) => item.name === 'agrostar')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'AgroStar')
  assert.equal(provider.companyCareerPage, 'https://corporate.agrostar.in/join-us')
  assert.match(scraper.dryRunFile, /agrostar[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'AgroStar\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AgroStar', 'agrostar', 'AgroStar']],
  )
})
