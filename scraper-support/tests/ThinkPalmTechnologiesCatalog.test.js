import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/thinkpalmtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/thinkpalmtechnologies/catalog.js')
  } catch {
    assert.fail('Expected ThinkPalm Technologies catalog module at ../../scraper/thinkpalmtechnologies/catalog.js')
  }
}

test('ThinkPalm Technologies local catalog captures the verified first-party open positions surface', async () => {
  const { THINKPALM_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(THINKPALM_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, THINKPALM_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'thinkpalmtechnologies')
  assert.equal(provider.companyName, 'ThinkPalm Technologies')
  assert.equal(provider.officialBrandName, 'ThinkPalm')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://thinkpalm.com/')
  assert.equal(provider.companyCareerPage, 'https://thinkpalm.com/company/careers/')
  assert.equal(provider.companyDomain, 'thinkpalm.com')
  assert.equal(provider.atsPlatform, 'official-first-party-open-positions')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'inline-open-position-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /thinkpalmtechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /DotNet Architect/i)
  assert.match(provider.verifiedSurfaceSummary, /Java Tech Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Cloud Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Trivandrum/i)
})

test('ThinkPalm Technologies exact backlog row resolves from the local provider contract', async () => {
  const { THINKPALM_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ThinkPalm Technologies\n',
    catalog: [hydrateProviderCatalogEntry(THINKPALM_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ThinkPalm Technologies', 'thinkpalmtechnologies', 'ThinkPalm Technologies']],
  )
})
