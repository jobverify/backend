import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/gartner/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gartner/catalog.js')
  } catch {
    assert.fail('Expected Gartner catalog module at ../../scraper/gartner/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/gartner/script.js')
  } catch {
    assert.fail('Expected Gartner scraper module at ../../scraper/gartner/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Gartner local catalog captures the verified browser-visible India jobs surface', async () => {
  const { GARTNER_CATALOG } = await loadCatalogModule()
  const gartner = await loadScriptModule()
  const provider = buildCatalogReadyProvider(GARTNER_CATALOG)

  assert.equal(provider.source, 'gartner')
  assert.equal(provider.companyName, 'Gartner')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://jobs.gartner.com/')
  assert.equal(provider.companyCareerPage, 'https://jobs.gartner.com/jobs/?country=India')
  assert.equal(provider.companyDomain, 'jobs.gartner.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'browser-rendered-page-query-until-no-new-results-or-verified-cloudflare-challenge-signal',
  )
  assert.equal(
    provider.extractionStrategy,
    'browser-rendered-listing-cards+detail-pages+workday-apply-handoff-or-verified-cloudflare-challenge-signal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /HR System Ops Specialist/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(provider.verifiedSurfaceSummary, /Workday/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /gartner[\\/]jobs\.json$/i)

  assert.equal(gartner.PROVIDER_METADATA.source, provider.source)
  assert.equal(gartner.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(gartner.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Gartner exact and India backlog rows resolve through local metadata plus shared alias mapping', async () => {
  const { GARTNER_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Gartner\nGartner India\n',
    catalog: [buildCatalogReadyProvider(GARTNER_CATALOG)],
    aliasMap: companyAliases,
  })

  assert.equal(report.totalRows, 2)
  assert.equal(report.candidateRows, 2)
  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [
      ['Gartner', 'gartner', 'Gartner'],
      ['Gartner India', 'gartner', 'Gartner'],
    ],
  )
  assert.equal(companyAliases['Gartner India'], 'gartner')
})

test('getScraperCatalog includes Gartner as a verified browser-visible careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'gartner')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Gartner')
  assert.equal(provider.companyCareerPage, 'https://jobs.gartner.com/jobs/?country=India')
  assert.equal(provider.companyDomain, 'jobs.gartner.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /gartner[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Gartner scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'gartner')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'gartner')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers')
  assert.match(scraper.dryRunFile, /gartner[\\/]jobs\.json$/i)
})
