import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cdn77/catalog.js')
  } catch {
    assert.fail('Expected CDN77 catalog module at ../../scraper/cdn77/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cdn77/script.js')
  } catch {
    assert.fail('Expected CDN77 scraper module at ../../scraper/cdn77/script.js')
  }
}

test('CDN77 local catalog captures the verified first-party jobs page and Prague-only public inventory evidence', async () => {
  const { CDN77_CATALOG } = await loadCatalogModule()
  const cdn77 = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CDN77_CATALOG)

  assert.equal(provider.source, 'cdn77')
  assert.equal(provider.companyName, 'CDN77')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cdn77.jobs/')
  assert.equal(provider.companyDomain, 'cdn77.jobs')
  assert.equal(provider.verifiedPublicJobCount, 16)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-server-rendered-jobs-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-jobs-page+server-rendered-job-cards+visible-count-validation+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /cdn77[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cdn77[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cdn77\.jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /DataCamp Limited/i)
  assert.match(provider.verifiedSurfaceSummary, /Všechny nabídky/i)
  assert.match(provider.verifiedSurfaceSummary, /\b16\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Praha 10, Česko/i)
  assert.match(provider.verifiedSurfaceSummary, /no India roles/i)

  assert.equal(cdn77.PROVIDER_METADATA.source, provider.source)
  assert.equal(cdn77.CAREERS_URL, provider.companyCareerPage)
})

test('CDN77 exact-name backlog rows resolve directly from local provider metadata without aliases', async () => {
  const { CDN77_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'CDN77\n',
    catalog: [hydrateProviderCatalogEntry(CDN77_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CDN77', 'cdn77', 'CDN77']],
  )
})

test('getScraperCatalog includes CDN77 as a verified exact-name script provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'cdn77')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CDN77')
  assert.equal(provider.companyCareerPage, 'https://www.cdn77.jobs/')
  assert.equal(provider.companyDomain, 'cdn77.jobs')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /cdn77[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable CDN77 scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cdn77')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cdn77')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /cdn77[\\/]jobs\.json$/i)
})
