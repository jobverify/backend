import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const hingeHealthIndiaModulePath = path.resolve(
  currentDir,
  '../../scraper/hingehealthindia/script.js',
)

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hingehealthindia/catalog.js')
  } catch {
    assert.fail('Expected Hinge Health India catalog module at ../../scraper/hingehealthindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hingehealthindia/script.js')
  } catch {
    assert.fail('Expected Hinge Health India scraper module at ../../scraper/hingehealthindia/script.js')
  }
}

test('Hinge Health India local catalog captures the verified official-site-to-Ashby handoff without alias churn', async () => {
  const { HINGE_HEALTH_INDIA_CATALOG } = await loadCatalogModule()
  const hingeHealthIndia = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HINGE_HEALTH_INDIA_CATALOG)

  assert.equal(provider.source, 'hingehealthindia')
  assert.equal(provider.companyName, 'Hinge Health India')
  assert.equal(provider.officialBrandName, 'Hinge Health')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.hingehealth.com/about/culture-and-engagement/')
  assert.equal(provider.officialCulturePageUrl, 'https://www.hingehealth.com/about/culture-and-engagement/')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/hinge-health')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/hinge-health')
  assert.equal(provider.companyDomain, 'hingehealth.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'official-site-handoff-plus-public-ashby-job-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-culture-page-handoff+public-ashby-job-board-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /hingehealthindia[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.hingehealth\.com\/about\/culture-and-engagement\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/hinge-health/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/hinge-health/i)
  assert.match(provider.verifiedSurfaceSummary, /Bengaluru/i)
  assert.match(provider.verifiedSurfaceSummary, /Workday System Admin/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Software Engineer-Backend/i)
  assert.equal(provider.modulePath, hingeHealthIndiaModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hinge Health India'), false)

  assert.equal(
    hingeHealthIndia.PROVIDER_METADATA.source,
    HINGE_HEALTH_INDIA_CATALOG.source,
  )
  assert.equal(
    hingeHealthIndia.PROVIDER_METADATA.companyName,
    HINGE_HEALTH_INDIA_CATALOG.companyName,
  )
  assert.equal(
    hingeHealthIndia.PROVIDER_METADATA.ashbyJobBoardUrl,
    HINGE_HEALTH_INDIA_CATALOG.ashbyJobBoardUrl,
  )
})

test('Hinge Health India backlog row matches directly from the local catalog without aliases', async () => {
  const { HINGE_HEALTH_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hinge Health India\n',
    catalog: [hydrateProviderCatalogEntry(HINGE_HEALTH_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hinge Health India', 'hingehealthindia', 'Hinge Health India']],
  )
})

test('getScraperCatalog includes Hinge Health India as a verified Ashby provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hingehealthindia')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hinge Health India')
  assert.equal(provider.companyCareerPage, 'https://www.hingehealth.com/about/culture-and-engagement/')
  assert.equal(provider.companyDomain, 'hingehealth.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.match(provider.modulePath, /hingehealthindia[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hinge Health India scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hingehealthindia')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hingehealthindia')
  assert.equal(scraper.provider.atsPlatform, 'ashby')
  assert.match(scraper.dryRunFile, /hingehealthindia[\\/]jobs\.json$/i)
})
