import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const hiverModulePath = path.resolve(currentDir, '../../scraper/hiver/script.js')

const loadHiverCatalog = async () => {
  try {
    return await import('../../scraper/hiver/catalog.js')
  } catch {
    assert.fail('Expected Hiver catalog module at ../../scraper/hiver/catalog.js')
  }
}

test('Hiver local catalog captures the verified first-party empty-board Pinpoint contract', async () => {
  const { HIVER_CATALOG } = await loadHiverCatalog()
  const provider = hydrateProviderCatalogEntry(HIVER_CATALOG)

  assert.equal(provider.source, 'hiver')
  assert.equal(provider.companyName, 'Hiver')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://hiverhq.com/careers')
  assert.equal(provider.officialPinpointBoardUrl, 'https://hiverhq.pinpointhq.com/')
  assert.equal(provider.pinpointPostingsUrl, 'https://hiverhq.pinpointhq.com/postings.json')
  assert.equal(provider.pinpointRssUrl, 'https://hiverhq.pinpointhq.com/jobs.rss')
  assert.equal(provider.companyDomain, 'hiverhq.com')
  assert.equal(provider.atsPlatform, 'pinpointhq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-empty-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-pinpoint-empty-board-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, hiverModulePath)
  assert.match(provider.dryRunFile, /hiver[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hiverhq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hiverhq\.pinpointhq\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /No open positions currently/i)
  assert.match(provider.verifiedSurfaceSummary, /There are currently no positions advertised/i)
})

test('Hiver backlog rows resolve from local provider metadata without alias churn', async () => {
  const { HIVER_CATALOG } = await loadHiverCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'Hiver\n',
    catalog: [hydrateProviderCatalogEntry(HIVER_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hiver', 'hiver', 'Hiver']],
  )
})

test('getScraperCatalog includes Hiver as a verified empty-board Pinpoint provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hiver')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hiver')
  assert.equal(provider.companyCareerPage, 'https://hiverhq.com/careers')
  assert.equal(provider.companyDomain, 'hiverhq.com')
  assert.equal(provider.atsPlatform, 'pinpointhq')
  assert.match(provider.modulePath, /hiver[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Hiver scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hiver')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hiver')
  assert.equal(scraper.provider.atsPlatform, 'pinpointhq')
  assert.match(scraper.dryRunFile, /hiver[\\/]jobs\.json$/i)
})
