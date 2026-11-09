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
const dozeeModulePath = path.resolve(currentDir, '../../scraper/dozee/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/dozee/catalog.js')
  } catch {
    assert.fail('Expected Dozee catalog module at ../../scraper/dozee/catalog.js')
  }
}

test('Dozee local catalog captures the verified first-party careers handoff and public Lever metadata', async () => {
  const {
    DOZEE_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(DOZEE_CATALOG.source, 'dozee')
  assert.equal(DOZEE_CATALOG.companyName, 'Dozee')
  assert.equal(DOZEE_CATALOG.officialBrandName, 'Dozee')
  assert.equal(DOZEE_CATALOG.adapter, 'script')
  assert.equal(DOZEE_CATALOG.modulePath, dozeeModulePath)
  assert.equal(DOZEE_CATALOG.dryRunFile, 'dozee/jobs.json')
  assert.equal(DOZEE_CATALOG.officialHomepageUrl, 'https://www.dozeehealth.ai/')
  assert.equal(DOZEE_CATALOG.companyCareerPage, 'https://www.dozeehealth.ai/careers')
  assert.equal(DOZEE_CATALOG.companyDomain, 'dozeehealth.ai')
  assert.equal(DOZEE_CATALOG.officialLeverBoardUrl, 'https://jobs.lever.co/dozee')
  assert.equal(DOZEE_CATALOG.leverApiUrl, 'https://api.lever.co/v0/postings/dozee?mode=json')
  assert.equal(DOZEE_CATALOG.verifiedIndiaCountryCode, 'IN')
  assert.equal(DOZEE_CATALOG.verifiedLeverPostingCount, 32)
  assert.equal(DOZEE_CATALOG.verifiedIndiaRoleCount, 24)
  assert.equal(
    DOZEE_CATALOG.verifiedSampleIndiaJobUrl,
    'https://jobs.lever.co/dozee/ccbcd4a2-0672-4139-b067-bb3905ff2738',
  )
  assert.equal(DOZEE_CATALOG.atsPlatform, 'lever')
  assert.equal(DOZEE_CATALOG.countryFilter, 'India')
  assert.equal(
    DOZEE_CATALOG.paginationStrategy,
    'official-homepage-plus-careers-validation-plus-lever-api',
  )
  assert.equal(
    DOZEE_CATALOG.extractionStrategy,
    'verified-first-party-homepage+verified-careers-page+verified-lever-board+lever-postings-api+india-country-filter',
  )
  assert.equal(DOZEE_CATALOG.parser, 'custom-script')
  assert.equal(DOZEE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(DOZEE_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(DOZEE_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dozeehealth\.ai\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.dozeehealth\.ai\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/jobs\.lever\.co\/dozee/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/api\.lever\.co\/v0\/postings\/dozee\?mode=json/i,
  )
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /https:\/\/jobs\.lever\.co\/dozee\/ccbcd4a2-0672-4139-b067-bb3905ff2738/i,
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b24 India roles\b/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /\b32 public postings\b/i)
})

test('Dozee local catalog hydrates into coverage without needing an alias entry', async () => {
  const { DOZEE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DOZEE_CATALOG)

  assert.equal(provider.companyName, 'Dozee')
  assert.equal(provider.companyDomain, 'dozeehealth.ai')
  assert.match(provider.modulePath, /dozee[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /dozee[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dozee\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dozee', 'dozee', 'Dozee']],
  )
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Dozee'), false)
})

test('buildScrapers and company coverage resolve Dozee from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'dozee')
  const scraper = buildScrapers().find((item) => item.name === 'dozee')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Dozee')
  assert.equal(provider.companyCareerPage, 'https://www.dozeehealth.ai/careers')
  assert.match(scraper.dryRunFile, /dozee[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Dozee\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Dozee', 'dozee', 'Dozee']],
  )
})
