import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/trawextechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/trawextechnologies/catalog.js')
  } catch {
    assert.fail('Expected Trawex Technologies catalog module at ../../scraper/trawextechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/trawextechnologies/script.js')
  } catch {
    assert.fail('Expected Trawex Technologies scraper module at ../../scraper/trawextechnologies/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Trawex Technologies local catalog captures the verified same-domain careers listings and role pages', async () => {
  const { TRAWEX_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const trawex = await loadScriptModule()
  const provider = buildCatalogReadyProvider(TRAWEX_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, TRAWEX_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'trawextechnologies')
  assert.equal(provider.companyName, 'Trawex Technologies')
  assert.equal(provider.officialBrandName, 'Trawex Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.trawex.com/')
  assert.equal(provider.companyCareerPage, 'https://www.trawex.com/careers.php')
  assert.equal(provider.sampleRoleUrl, 'https://www.trawex.com/senior-angular-developer.php')
  assert.equal(provider.sampleBusinessRoleUrl, 'https://www.trawex.com/business-development-manager.php')
  assert.equal(provider.atsPlatform, 'official-first-party-role-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'same-domain-listing-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'trawex.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Angular Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Development Manager/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /trawextechnologies[\\/]jobs\.json$/i)

  assert.equal(trawex.PROVIDER_METADATA.source, provider.source)
  assert.equal(trawex.PROVIDER_METADATA.sampleRoleUrl, provider.sampleRoleUrl)
})

test('Trawex Technologies exact backlog row resolves from the local provider contract', async () => {
  const { TRAWEX_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Trawex Technologies\n',
    catalog: [buildCatalogReadyProvider(TRAWEX_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Trawex Technologies', 'trawextechnologies', 'Trawex Technologies']],
  )
})
