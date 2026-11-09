import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fastrackModulePath = path.resolve(currentDir, '../../scraper/fastrack/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fastrack/catalog.js')
  } catch {
    assert.fail('Expected Fastrack catalog module at ../../scraper/fastrack/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fastrack/script.js')
  } catch {
    assert.fail('Expected Fastrack scraper module at ../../scraper/fastrack/script.js')
  }
}

test('Fastrack local catalog captures the verified brand-homepage careers handoff and zero-openings Titan search surface', async () => {
  const {
    FASTRACK_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()
  const fastrack = await loadScriptModule()

  assert.equal(FASTRACK_CATALOG.source, 'fastrack')
  assert.equal(FASTRACK_CATALOG.companyName, 'Fastrack')
  assert.equal(FASTRACK_CATALOG.officialBrandName, 'Fastrack')
  assert.equal(FASTRACK_CATALOG.adapter, 'script')
  assert.equal(FASTRACK_CATALOG.modulePath, fastrackModulePath)
  assert.equal(FASTRACK_CATALOG.dryRunFile, 'fastrack/jobs.json')
  assert.equal(FASTRACK_CATALOG.companyCareerPage, 'https://careers.titan.in/?rms=titan')
  assert.equal(FASTRACK_CATALOG.companyDomain, 'fastrack.in')
  assert.equal(FASTRACK_CATALOG.officialHomepageUrl, 'https://www.fastrack.in/')
  assert.equal(FASTRACK_CATALOG.officialCareersHandoffUrl, 'https://careers.titan.in/?rms=titan')
  assert.equal(FASTRACK_CATALOG.officialCareersHomeUrl, 'https://careers.titan.in/in/en')
  assert.equal(FASTRACK_CATALOG.titanCorporateCareersUrl, 'https://www.titancompany.in/careers')
  assert.equal(
    FASTRACK_CATALOG.officialSearchResultsUrl,
    'https://careers.titan.in/in/en/search-results',
  )
  assert.equal(FASTRACK_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(FASTRACK_CATALOG.countryFilter, 'India')
  assert.equal(
    FASTRACK_CATALOG.paginationStrategy,
    'brand-homepage-to-parent-careers-handoff-no-public-fastrack-jobs',
  )
  assert.equal(
    FASTRACK_CATALOG.extractionStrategy,
    'verified-fastrack-homepage+verified-footer-careers-handoff+verified-titan-brand-inclusive-careers-page+verified-titan-jobs-home+verified-zero-results-search-shell-return-empty',
  )
  assert.equal(FASTRACK_CATALOG.parser, 'custom-script')
  assert.equal(FASTRACK_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FASTRACK_CATALOG.verifiedOn, '2026-10-03')
  assert.equal(FASTRACK_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.fastrack\.in\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.titan\.in\/\?rms=titan/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.titan\.in\/in\/en/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.titancompany\.in\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/careers\.titan\.in\/in\/en\/search-results/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Fastrack/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Sorry\.\.\. no active job openings, please come back later\./i)

  assert.equal(fastrack.PROVIDER_METADATA.source, FASTRACK_CATALOG.source)
  assert.equal(fastrack.PROVIDER_METADATA.companyName, FASTRACK_CATALOG.companyName)
  assert.equal(fastrack.HOMEPAGE_URL, FASTRACK_CATALOG.officialHomepageUrl)
  assert.equal(fastrack.CAREERS_HANDOFF_URL, FASTRACK_CATALOG.officialCareersHandoffUrl)
  assert.equal(fastrack.SEARCH_RESULTS_URL, FASTRACK_CATALOG.officialSearchResultsUrl)
})

test('Fastrack local catalog hydrates exact-name coverage without shared-registry edits', async () => {
  const { FASTRACK_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FASTRACK_CATALOG)

  assert.equal(provider.companyName, 'Fastrack')
  assert.equal(provider.companyDomain, 'fastrack.in')
  assert.match(provider.modulePath, /fastrack[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /fastrack[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Fastrack\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Fastrack', 'fastrack', 'Fastrack']],
  )
})
