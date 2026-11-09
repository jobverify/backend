import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cypherox/script.js')

const aliasMap = {
  'Cypherox Technologies Pvt. Ltd.': 'cypherox',
  'Cypherox Technologies Pvt Ltd': 'cypherox',
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cypherox/catalog.js')
  } catch {
    assert.fail('Expected Cypherox catalog module at ../../scraper/cypherox/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cypherox/script.js')
  } catch {
    assert.fail('Expected Cypherox scraper module at ../../scraper/cypherox/script.js')
  }
}

test('Cypherox local catalog captures the verified first-party careers page and embedded job graph', async () => {
  const { CYPHEROX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const cypherox = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(CYPHEROX_CATALOG)

  assert.equal(defaultCatalog, CYPHEROX_CATALOG)
  assert.equal(provider.source, 'cypherox')
  assert.equal(provider.companyName, 'Cypherox Technologies')
  assert.equal(provider.officialBrandName, 'Cypherox Technologies Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.cypherox.com/career')
  assert.equal(provider.companyDomain, 'cypherox.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+embedded-jobposting-graph',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cypherox[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.cypherox\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /WordPress Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Executive/i)
  assert.equal(companyAliases['Cypherox Technologies Pvt. Ltd.'], 'cypherox')
  assert.equal(companyAliases['Cypherox Technologies Pvt Ltd'], 'cypherox')

  assert.equal(cypherox.PROVIDER_METADATA.source, CYPHEROX_CATALOG.source)
  assert.equal(cypherox.PROVIDER_METADATA.companyCareerPage, CYPHEROX_CATALOG.companyCareerPage)
})

test('Cypherox local coverage contract documents the exact alias snippet the controller should later integrate', async () => {
  const { CYPHEROX_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cypherox Technologies\nCypherox Technologies Pvt. Ltd.\nCypherox Technologies Pvt Ltd\n',
    catalog: [hydrateProviderCatalogEntry(CYPHEROX_CATALOG)],
    aliasMap,
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Cypherox Technologies', 'cypherox', 'Cypherox Technologies'],
      ['Cypherox Technologies Pvt. Ltd.', 'cypherox', 'Cypherox Technologies'],
      ['Cypherox Technologies Pvt Ltd', 'cypherox', 'Cypherox Technologies'],
    ],
  )
})

test('Cypherox hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { CYPHEROX_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CYPHEROX_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Cypherox Technologies')
  assert.match(provider.modulePath, /cypherox[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /cypherox[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
