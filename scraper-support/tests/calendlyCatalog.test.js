import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/calendly/catalog.js')
  } catch {
    assert.fail('Expected Calendly catalog module at ../../scraper/calendly/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/calendly/script.js')
  } catch {
    assert.fail('Expected Calendly scraper module at ../../scraper/calendly/script.js')
  }
}

test('Calendly local catalog captures the verified official careers page plus Greenhouse metadata', async () => {
  const { CALENDLY_CATALOG } = await loadCatalogModule()
  const calendly = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CALENDLY_CATALOG)

  assert.equal(provider.source, 'calendly')
  assert.equal(provider.companyName, 'Calendly')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://calendly.com/careers')
  assert.equal(provider.companyDomain, 'calendly.com')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/calendly')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/calendly/jobs',
  )
  assert.equal(provider.verifiedPublicJobCount, 9)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'complete-greenhouse-count-and-stable-snapshot',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-calendly-handoff+careers-card-ids+complete-feed+full-content+stable-snapshot+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-09')
  assert.match(provider.modulePath, /calendly[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /calendly[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 9, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/calendly\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/calendly/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/calendly\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /9 live roles/i)
  assert.match(provider.verifiedSurfaceSummary, /no India roles/i)

  assert.equal(calendly.PROVIDER_METADATA.source, provider.source)
  assert.equal(calendly.CAREERS_URL, provider.companyCareerPage)
  assert.equal(calendly.GREENHOUSE_BOARD_URL, provider.greenhouseBoardUrl)
  assert.equal(calendly.GREENHOUSE_JOBS_API_URL, provider.greenhouseJobsApiUrl)
})

test('Calendly exact-name backlog rows resolve directly from local provider metadata without alias extensions', async () => {
  const { CALENDLY_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Calendly\n',
    catalog: [hydrateProviderCatalogEntry(CALENDLY_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Calendly', 'calendly', 'Calendly']],
  )
})

test('getScraperCatalog includes Calendly as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'calendly')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Calendly')
  assert.equal(provider.companyCareerPage, 'https://calendly.com/careers')
  assert.equal(provider.companyDomain, 'calendly.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /calendly[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Calendly scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'calendly')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'calendly')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /calendly[\\/]jobs\.json$/i)
})
