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
const modulePath = path.resolve(currentDir, '../../scraper/aisle/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aisle/catalog.js')
  } catch {
    assert.fail('Expected Aisle catalog module at ../../scraper/aisle/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/aisle/script.js')
  } catch {
    assert.fail('Expected Aisle scraper module at ../../scraper/aisle/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Aisle local catalog captures the verified homepage handoff to the public Freshteam board outage sentinel', async () => {
  const { AISLE_CATALOG } = await loadCatalogModule()
  const aisle = await loadScraperModule()
  const provider = buildCatalogReadyProvider(AISLE_CATALOG)

  assert.equal(provider.source, 'aisle')
  assert.equal(provider.companyName, 'Aisle')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.aisle.co/')
  assert.equal(provider.companyDomain, 'aisle.co')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-public-freshteam-board-or-verified-500-outage')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-handoff+public-freshteam-board-or-verified-500-outage-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.officialHomepageUrl, 'https://www.aisle.co/')
  assert.equal(provider.officialJobsBoardUrl, 'https://aisle.freshteam.com/jobs')
  assert.equal(
    provider.detailUrlPattern,
    'https://aisle.freshteam.com/jobs/{opaque_id}/{slug}',
  )
  assert.equal(provider.verifiedOn, '2026-07-28')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.aisle\.co\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/aisle\.freshteam\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /generic freshteam 500 error page/i)
  assert.match(provider.verifiedSurfaceSummary, /Check Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /returns an empty set until the exact public board recovers/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /aisle[\\/]jobs\.json$/i)

  assert.equal(aisle.PROVIDER_METADATA.source, provider.source)
  assert.equal(aisle.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(aisle.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(aisle.PROVIDER_METADATA.officialJobsBoardUrl, provider.officialJobsBoardUrl)
})

test('Aisle exact backlog name matches from the local provider contract without aliases', async () => {
  const { AISLE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aisle\n',
    catalog: [buildCatalogReadyProvider(AISLE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aisle', 'aisle', 'Aisle']],
  )
})

test('buildScrapers and company coverage resolve Aisle from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'aisle')
  const scraper = buildScrapers().find((item) => item.name === 'aisle')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Aisle')
  assert.equal(provider.companyCareerPage, 'https://www.aisle.co/')
  assert.match(scraper.dryRunFile, /aisle[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Aisle\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Aisle', 'aisle', 'Aisle']],
  )
})
