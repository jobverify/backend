import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/codebrewlabs/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/codebrewlabs/catalog.js')
  } catch {
    assert.fail('Expected Code Brew Labs catalog module at ../../scraper/codebrewlabs/catalog.js')
  }
}

test('Code Brew Labs local catalog captures the verified first-party careers listings', async () => {
  const { CODE_BREW_LABS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CODE_BREW_LABS_CATALOG)

  assert.equal(defaultCatalog, CODE_BREW_LABS_CATALOG)
  assert.equal(provider.source, 'codebrewlabs')
  assert.equal(provider.companyName, 'Code Brew Labs')
  assert.equal(provider.officialBrandName, 'Code Brew Labs')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.code-brew.com/')
  assert.equal(provider.companyCareerPage, 'https://www.code-brew.com/careers/')
  assert.equal(provider.companyDomain, 'code-brew.com')
  assert.equal(provider.atsPlatform, 'official-first-party-role-sections')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'same-page-role-sections')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /codebrewlabs[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Nodejs Developer Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Angular Developer Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Chandigarh/i)
})

test('Code Brew Labs exact backlog row resolves from the local provider contract', async () => {
  const { CODE_BREW_LABS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Code Brew Labs\n',
    catalog: [hydrateProviderCatalogEntry(CODE_BREW_LABS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Code Brew Labs', 'codebrewlabs', 'Code Brew Labs']],
  )
})
