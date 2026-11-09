import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/indiitsolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/indiitsolutions/catalog.js')
  } catch {
    assert.fail('Expected INDI IT SOLUTIONS catalog module at ../../scraper/indiitsolutions/catalog.js')
  }
}

test('INDI IT SOLUTIONS local catalog captures the verified first-party career openings page', async () => {
  const { INDI_IT_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(INDI_IT_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, INDI_IT_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'indiitsolutions')
  assert.equal(provider.companyName, 'INDI IT SOLUTIONS')
  assert.equal(provider.officialBrandName, 'Indi IT Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://indiit.com/career/')
  assert.equal(provider.officialCareersPageUrl, 'https://indiit.com/career/')
  assert.equal(provider.companyDomain, 'indiit.com')
  assert.equal(provider.atsPlatform, 'first-party-html-open-roles')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-page+html-opportunity-cards')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /indiitsolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /five visible roles/i)
  assert.match(provider.verifiedSurfaceSummary, /two separate Marketing Analyst cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Top Opportunities Right Now/i)
  assert.match(provider.verifiedSurfaceSummary, /hr@indiit\.com/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'INDI IT SOLUTIONS'), false)
})

test('INDI IT SOLUTIONS exact backlog row matches from the local catalog entry', async () => {
  const { INDI_IT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'INDI IT SOLUTIONS\n',
    catalog: [hydrateProviderCatalogEntry(INDI_IT_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['INDI IT SOLUTIONS', 'indiitsolutions', 'INDI IT SOLUTIONS']],
  )
})

test('INDI IT SOLUTIONS hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { INDI_IT_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(INDI_IT_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://indiit.com/career/')
  assert.equal(provider.companyDomain, 'indiit.com')
  assert.match(provider.modulePath, /indiitsolutions[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
