import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/artefact/catalog.js')
  } catch {
    assert.fail('Expected Artefact catalog module at ../../scraper/artefact/catalog.js')
  }
}

test('Artefact local catalog captures the Thursday, August 13, 2026 blocked-first-party plus Greenhouse public surface without aliases', async () => {
  const { ARTEFACT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ARTEFACT_CATALOG)

  assert.equal(provider.source, 'artefact')
  assert.equal(provider.companyName, 'Artefact')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.artefact.com/careers/')
  assert.equal(provider.homepageUrl, 'https://www.artefact.com/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/artefact')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/artefact/jobs?content=true')
  assert.equal(provider.companyDomain, 'artefact.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'bunkerweb-blocked-first-party-pages-plus-public-greenhouse-board-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-bot-detection-first-party-pages+public-greenhouse-board+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.modulePath, /artefact[\\/]script\.js$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.artefact\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /Bot Detection/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/artefact/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/artefact\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/8360407002/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/7884340002/i)
  assert.match(provider.verifiedSurfaceSummary, /6 India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Artefact'), false)
})

test('Artefact backlog row matches directly from the local provider metadata without alias churn', async () => {
  const { ARTEFACT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Artefact\n',
    catalog: [hydrateProviderCatalogEntry(ARTEFACT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Artefact', 'artefact', 'Artefact']],
  )
})

test('buildScrapers and company coverage resolve Artefact from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'artefact')
  const scraper = buildScrapers().find((item) => item.name === 'artefact')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Artefact')
  assert.equal(provider.companyCareerPage, 'https://www.artefact.com/careers/')
  assert.match(scraper.dryRunFile, /artefact[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Artefact\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Artefact', 'artefact', 'Artefact']],
  )
})
