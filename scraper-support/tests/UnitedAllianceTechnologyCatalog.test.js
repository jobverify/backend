import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/unitedalliancetechnology/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/unitedalliancetechnology/catalog.js')
  } catch {
    assert.fail('Expected United Alliance Technology catalog module at ../../scraper/unitedalliancetechnology/catalog.js')
  }
}

test('United Alliance Technology local catalog captures the unreachable exact-name first-party domain contract', async () => {
  const { UNITED_ALLIANCE_TECHNOLOGY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(UNITED_ALLIANCE_TECHNOLOGY_CATALOG)

  assert.equal(defaultCatalog, UNITED_ALLIANCE_TECHNOLOGY_CATALOG)
  assert.equal(provider.source, 'unitedalliancetechnology')
  assert.equal(provider.companyName, 'United Alliance Technology')
  assert.equal(provider.officialBrandName, 'United Alliance Technology')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://unitedalliancetechnology.com/')
  assert.equal(provider.companyCareerPage, 'https://unitedalliancetechnology.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://unitedalliancetechnology.com/')
  assert.equal(provider.companyDomain, 'unitedalliancetechnology.com')
  assert.equal(provider.atsPlatform, 'official-company-domain-unreachable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-exact-domain-probe')
  assert.equal(provider.extractionStrategy, 'exact-name-domain-dns-failure-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /unitedalliancetechnology[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Could not resolve host/i)
  assert.match(provider.verifiedSurfaceSummary, /exact-name first-party domain/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'United Alliance Technology'), false)
})

test('United Alliance Technology exact backlog row matches from the local catalog entry', async () => {
  const { UNITED_ALLIANCE_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'United Alliance Technology\n',
    catalog: [hydrateProviderCatalogEntry(UNITED_ALLIANCE_TECHNOLOGY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['United Alliance Technology', 'unitedalliancetechnology', 'United Alliance Technology']],
  )
})

test('United Alliance Technology hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { UNITED_ALLIANCE_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(UNITED_ALLIANCE_TECHNOLOGY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://unitedalliancetechnology.com/')
  assert.equal(provider.companyDomain, 'unitedalliancetechnology.com')
  assert.match(provider.modulePath, /unitedalliancetechnology[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
