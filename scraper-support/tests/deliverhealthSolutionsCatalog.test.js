import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/deliverhealthsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/deliverhealthsolutions/catalog.js')
  } catch {
    assert.fail('Expected DeliverHealth Solutions catalog module at ../../scraper/deliverhealthsolutions/catalog.js')
  }
}

test('DeliverHealth Solutions local catalog captures the verified first-party ADP handoff without alias churn', async () => {
  const { DELIVERHEALTH_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DELIVERHEALTH_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, DELIVERHEALTH_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'deliverhealthsolutions')
  assert.equal(provider.companyName, 'DeliverHealth Solutions')
  assert.equal(provider.officialBrandName, 'DeliverHealth')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://ai.deliverhealth.com/careers')
  assert.equal(provider.companyDomain, 'deliverhealth.com')
  assert.equal(provider.atsPlatform, 'adp-workforcenow')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-adp-job-requisitions-call')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page-direct-adp-link-or-bundle+verified-public-adp-board+job-requisitions-api+detail-api+india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.dryRunFile, /deliverhealthsolutions[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Browse Open Roles link/i)
  assert.match(provider.verifiedSurfaceSummary, /workforcenow\.adp\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /no live openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'DeliverHealth Solutions'), false)
})

test('DeliverHealth Solutions backlog row matches directly from the local catalog', async () => {
  const { DELIVERHEALTH_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'DeliverHealth Solutions\n',
    catalog: [hydrateProviderCatalogEntry(DELIVERHEALTH_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['DeliverHealth Solutions', 'deliverhealthsolutions', 'DeliverHealth Solutions']],
  )
})

test('DeliverHealth Solutions hydrated local catalog stays script-runner compatible', async () => {
  const { DELIVERHEALTH_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DELIVERHEALTH_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'DeliverHealth Solutions')
  assert.equal(provider.companyCareerPage, 'https://ai.deliverhealth.com/careers')
  assert.equal(provider.companyDomain, 'deliverhealth.com')
  assert.equal(provider.atsPlatform, 'adp-workforcenow')
  assert.equal(typeof module.run, 'function')
})
