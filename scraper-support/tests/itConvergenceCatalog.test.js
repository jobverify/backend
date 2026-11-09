import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/itconvergence/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/itconvergence/catalog.js')
  } catch {
    assert.fail('Expected IT Convergence catalog module at ../../scraper/itconvergence/catalog.js')
  }
}

test('IT Convergence local catalog captures the verified no-public-openings sentinel contract', async () => {
  const { IT_CONVERGENCE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(IT_CONVERGENCE_CATALOG)

  assert.equal(defaultCatalog, IT_CONVERGENCE_CATALOG)
  assert.equal(provider.source, 'itconvergence')
  assert.equal(provider.companyName, 'IT Convergence')
  assert.equal(provider.officialBrandName, 'IT Convergence')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.itconvergence.com/careers/')
  assert.equal(provider.homepageUrl, 'https://www.itconvergence.com/')
  assert.equal(provider.atsPlatform, 'first-party-no-public-jobs-sentinel')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-page-without-public-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+no-public-openings-signals+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'itconvergence.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.dryRunFile, /itconvergence[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Careers - IT Convergence/i)
  assert.match(provider.verifiedSurfaceSummary, /Life at IT Convergence/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('IT Convergence exact backlog row resolves directly from the local provider metadata', async () => {
  const { IT_CONVERGENCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'IT Convergence\n',
    catalog: [hydrateProviderCatalogEntry(IT_CONVERGENCE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['IT Convergence', 'itconvergence', 'IT Convergence']],
  )
})

test('IT Convergence hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { IT_CONVERGENCE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(IT_CONVERGENCE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, IT_CONVERGENCE_CATALOG.companyCareerPage)
  assert.equal(provider.companyDomain, 'itconvergence.com')
  assert.equal(provider.atsPlatform, 'first-party-no-public-jobs-sentinel')
  assert.match(provider.modulePath, /itconvergence[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /itconvergence[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
