import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rajlaxmisolutionsprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rajlaxmisolutionsprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected Rajlaxmi Solutions Private Limited catalog module at ../../scraper/rajlaxmisolutionsprivatelimited/catalog.js')
  }
}

test('Rajlaxmi Solutions Private Limited local catalog captures the verified first-party join-us page contract', async () => {
  const { RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'rajlaxmisolutionsprivatelimited')
  assert.equal(provider.companyName, 'Rajlaxmi Solutions Private Limited')
  assert.equal(provider.officialBrandName, 'Rajlaxmi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://rajlaxmiworld.com/')
  assert.equal(provider.companyCareerPage, 'https://rajlaxmiworld.com/join-us/')
  assert.equal(provider.officialCareersPageUrl, 'https://rajlaxmiworld.com/join-us/')
  assert.equal(provider.companyDomain, 'rajlaxmiworld.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-join-us-html-job-cards',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Accountant/i)
  assert.match(provider.verifiedSurfaceSummary, /Bitrix24 Developer/i)
  assert.match(provider.dryRunFile, /rajlaxmisolutionsprivatelimited[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
})

test('Rajlaxmi Solutions Private Limited exact backlog row resolves from the local provider metadata', async () => {
  const { RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rajlaxmi Solutions Private Limited\n',
    catalog: [hydrateProviderCatalogEntry(RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rajlaxmi Solutions Private Limited', 'rajlaxmisolutionsprivatelimited', 'Rajlaxmi Solutions Private Limited']],
  )
})

test('Rajlaxmi Solutions Private Limited hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAJLAXMI_SOLUTIONS_PRIVATE_LIMITED_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://rajlaxmiworld.com/join-us/')
  assert.equal(provider.companyDomain, 'rajlaxmiworld.com')
  assert.match(provider.modulePath, /rajlaxmisolutionsprivatelimited[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
