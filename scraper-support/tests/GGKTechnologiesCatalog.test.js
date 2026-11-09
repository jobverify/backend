import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ggktechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ggktechnologies/catalog.js')
  } catch {
    assert.fail('Expected GGK Technologies catalog module at ../../scraper/ggktechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ggktechnologies/script.js')
  } catch {
    assert.fail('Expected GGK Technologies scraper module at ../../scraper/ggktechnologies/script.js')
  }
}

test('GGK Technologies local catalog captures the verified redirect-only first-party contract', async () => {
  const { GGK_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const ggk = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(GGK_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, GGK_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'ggktechnologies')
  assert.equal(provider.companyName, 'GGK Technologies')
  assert.equal(provider.officialBrandName, 'GGK Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://ggktech.com/')
  assert.equal(provider.companyCareerPage, 'https://ggktech.com/')
  assert.equal(provider.redirectTargetUrl, 'https://innovasolutions.com/')
  assert.equal(provider.companyDomain, 'ggktech.com')
  assert.equal(provider.atsPlatform, 'redirected-first-party-homepage-contract')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'root-domain-redirect-without-ggk-job-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-domain-redirect-to-foreign-brand-homepage-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /301 redirect/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/innovasolutions\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no GGK-branded public careers surface/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ggktechnologies[\\/]jobs\.json$/i)

  assert.equal(ggk.PROVIDER_METADATA.source, provider.source)
  assert.equal(ggk.PROVIDER_METADATA.redirectTargetUrl, provider.redirectTargetUrl)
})

test('GGK Technologies exact backlog row resolves from the local provider contract', async () => {
  const { GGK_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GGK Technologies\n',
    catalog: [hydrateProviderCatalogEntry(GGK_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['GGK Technologies', 'ggktechnologies', 'GGK Technologies']],
  )
})
