import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rssoftwareindia/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rssoftwareindia/catalog.js')
  } catch {
    assert.fail('Expected RS Software India catalog module at ../../scraper/rssoftwareindia/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('RS Software India local catalog captures the verified first-party join-team surface', async () => {
  const { RS_SOFTWARE_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(RS_SOFTWARE_INDIA_CATALOG)

  assert.equal(defaultCatalog, RS_SOFTWARE_INDIA_CATALOG)
  assert.equal(provider.source, 'rssoftwareindia')
  assert.equal(provider.companyName, 'RS Software (India) Ltd.')
  assert.equal(provider.officialBrandName, 'RS Software')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.rssoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://www.rssoftware.com/home/jointeam')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-join-team-page+same-page-apply-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'rssoftware.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rssoftware\.com\/home\/jointeam/i)
  assert.match(provider.verifiedSurfaceSummary, /Global Delivery Head/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager Sales, Bangalore\/Chennai/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /rssoftwareindia[\\/]jobs\.json$/i)
})

test('RS Software India exact backlog row resolves from the local provider contract without aliases', async () => {
  const { RS_SOFTWARE_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'RS Software (India) Ltd.\n',
    catalog: [buildCatalogReadyProvider(RS_SOFTWARE_INDIA_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['RS Software (India) Ltd.', 'rssoftwareindia', 'RS Software (India) Ltd.']],
  )
})
