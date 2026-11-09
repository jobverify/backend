import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const hindustanAeronauticsModulePath = path.resolve(
  currentDir,
  '../../scraper/hindustanaeronautics/script.js',
)

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hindustanaeronautics/catalog.js')
  } catch {
    assert.fail('Expected Hindustan Aeronautics catalog module at ../../scraper/hindustanaeronautics/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hindustanaeronautics/script.js')
  } catch {
    assert.fail('Expected Hindustan Aeronautics scraper module at ../../scraper/hindustanaeronautics/script.js')
  }
}

test('Hindustan Aeronautics local catalog captures the verified first-party careers API contract without alias churn', async () => {
  const { HINDUSTAN_AERONAUTICS_CATALOG } = await loadCatalogModule()
  const hindustanAeronautics = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HINDUSTAN_AERONAUTICS_CATALOG)

  assert.equal(provider.source, 'hindustanaeronautics')
  assert.equal(provider.companyName, 'Hindustan Aeronautics')
  assert.equal(provider.officialBrandName, 'Hindustan Aeronautics Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://hal-india.co.in/career')
  assert.equal(provider.officialCareersApiUrl, 'https://hal-india.co.in/backend/wp-json/hal/v1/career?lang=en')
  assert.equal(provider.officialCareerDetailApiUrl, 'https://hal-india.co.in/backend/wp-json/hal/v1/career_detail?lang=en')
  assert.equal(provider.officialTodayCareerApiUrl, 'https://hal-india.co.in/backend/wp-json/hal/v1/today_career?lang=en')
  assert.equal(
    provider.officialCorrigendumCareerApiUrl,
    'https://hal-india.co.in/backend/wp-json/hal/v1/corrigendum_count_career?lang=en',
  )
  assert.equal(provider.companyDomain, 'hal-india.co.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-official-careers-api-list-plus-official-detail-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+official-wp-json-career-list+detail-api+open-notice-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /hindustanaeronautics[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hal-india\.co\.in\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hal-india\.co\.in\/backend\/wp-json\/hal\/v1\/career\?lang=en/i)
  assert.match(provider.verifiedSurfaceSummary, /Barrackpore/i)
  assert.match(provider.verifiedSurfaceSummary, /ITI Trade Apprentices/i)
  assert.match(provider.verifiedSurfaceSummary, /shortlist|allotment|merit/i)
  assert.equal(provider.modulePath, hindustanAeronauticsModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hindustan Aeronautics'), false)

  assert.equal(
    hindustanAeronautics.PROVIDER_METADATA.source,
    HINDUSTAN_AERONAUTICS_CATALOG.source,
  )
  assert.equal(
    hindustanAeronautics.PROVIDER_METADATA.companyName,
    HINDUSTAN_AERONAUTICS_CATALOG.companyName,
  )
  assert.equal(
    hindustanAeronautics.PROVIDER_METADATA.officialCareersApiUrl,
    HINDUSTAN_AERONAUTICS_CATALOG.officialCareersApiUrl,
  )
})

test('Hindustan Aeronautics backlog row matches directly from the local catalog without aliases', async () => {
  const { HINDUSTAN_AERONAUTICS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hindustan Aeronautics\n',
    catalog: [hydrateProviderCatalogEntry(HINDUSTAN_AERONAUTICS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hindustan Aeronautics', 'hindustanaeronautics', 'Hindustan Aeronautics']],
  )
})

test('getScraperCatalog includes Hindustan Aeronautics as a verified first-party careers API provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hindustanaeronautics')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hindustan Aeronautics')
  assert.equal(provider.companyCareerPage, 'https://hal-india.co.in/career')
  assert.equal(provider.companyDomain, 'hal-india.co.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.match(provider.modulePath, /hindustanaeronautics[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hindustan Aeronautics scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hindustanaeronautics')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hindustanaeronautics')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers-api')
  assert.match(scraper.dryRunFile, /hindustanaeronautics[\\/]jobs\.json$/i)
})
