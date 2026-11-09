import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const itiliteModulePath = path.resolve(currentDir, '../../scraper/itilite/script.js')

const loadItiliteCatalog = async () => {
  try {
    return await import('../../scraper/itilite/catalog.js')
  } catch {
    assert.fail('Expected Itilite catalog module at ../../scraper/itilite/catalog.js')
  }
}

const loadItiliteModule = async () => {
  try {
    return await import('../../scraper/itilite/script.js')
  } catch {
    assert.fail('Expected Itilite scraper module at ../../scraper/itilite/script.js')
  }
}

test('Itilite local catalog captures the verified first-party India careers page and LinkedIn handoff metadata without aliases', async () => {
  const { ITILITE_CATALOG } = await loadItiliteCatalog()
  const itilite = await loadItiliteModule()
  const provider = hydrateProviderCatalogEntry(ITILITE_CATALOG)

  assert.equal(provider.source, 'itilite')
  assert.equal(provider.companyName, 'Itilite')
  assert.equal(provider.officialBrandName, 'ITILITE')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.itilite.com/in/careers')
  assert.equal(provider.globalCareersPage, 'https://www.itilite.com/careers')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-linkedin-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-india-careers-page+inline-job-cards+linkedin-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'itilite.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.modulePath, /itilite[\\/]script\.js$/i)
  assert.equal(provider.modulePath, itiliteModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.itilite\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.itilite\.com\/in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.linkedin\.com\/jobs\/view\/4110847363/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Travel Support/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Itilite'), false)

  assert.equal(itilite.PROVIDER_METADATA.source, ITILITE_CATALOG.source)
  assert.equal(itilite.PROVIDER_METADATA.companyName, ITILITE_CATALOG.companyName)
  assert.equal(
    itilite.PROVIDER_METADATA.companyCareerPage,
    ITILITE_CATALOG.companyCareerPage,
  )
})

test('Itilite backlog row matches directly from local provider metadata without alias churn', async () => {
  const { ITILITE_CATALOG } = await loadItiliteCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Itilite\n',
    catalog: [hydrateProviderCatalogEntry(ITILITE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Itilite', 'itilite', 'Itilite']],
  )
})

test('getScraperCatalog includes Itilite as a verified first-party careers-page provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'itilite')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Itilite')
  assert.equal(provider.companyCareerPage, 'https://www.itilite.com/in/careers')
  assert.equal(provider.companyDomain, 'itilite.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-with-linkedin-handoff')
  assert.match(provider.modulePath, /itilite[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Itilite scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'itilite')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'itilite')
  assert.equal(scraper.provider.atsPlatform, 'first-party-careers-page-with-linkedin-handoff')
  assert.match(scraper.dryRunFile, /itilite[\\/]jobs\.json$/i)
})
