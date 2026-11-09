import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/salesken/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/salesken/catalog.js')
  } catch {
    assert.fail('Expected Salesken catalog module at ../../scraper/salesken/catalog.js')
  }
}

test('Salesken local catalog captures the verified no-public-careers sentinel surface without alias churn', async () => {
  const { SALESKEN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SALESKEN_CATALOG)

  assert.equal(defaultCatalog, SALESKEN_CATALOG)
  assert.equal(provider.source, 'salesken')
  assert.equal(provider.companyName, 'Salesken')
  assert.equal(provider.officialBrandName, 'Salesken')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.salesken.ai/')
  assert.equal(provider.companyCareerPage, 'https://www.salesken.ai/careers')
  assert.equal(provider.verifiedJobsPageUrl, 'https://www.salesken.ai/jobs')
  assert.equal(provider.companyDomain, 'salesken.ai')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-missing-careers-and-jobs-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-navigation+verified-missing-careers-and-jobs-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /salesken[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.salesken\.ai\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.salesken\.ai\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.salesken\.ai\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Salesken'), false)
})

test('Salesken exact backlog row matches directly from the local provider metadata', async () => {
  const { SALESKEN_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Salesken\n',
    catalog: [hydrateProviderCatalogEntry(SALESKEN_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Salesken', 'salesken', 'Salesken']],
  )
})

test('Salesken hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SALESKEN_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SALESKEN_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Salesken')
  assert.equal(provider.companyCareerPage, 'https://www.salesken.ai/careers')
  assert.equal(provider.companyDomain, 'salesken.ai')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /salesken[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /salesken[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
