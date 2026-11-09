import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sigmasolve/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sigmasolve/catalog.js')
  } catch {
    assert.fail('Expected Sigma Solve catalog module at ../../scraper/sigmasolve/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sigmasolve/script.js')
  } catch {
    assert.fail('Expected Sigma Solve scraper module at ../../scraper/sigmasolve/script.js')
  }
}

test('Sigma Solve local catalog captures the verified first-party openings page and same-domain detail contract', async () => {
  const { SIGMA_SOLVE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sigmaSolve = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SIGMA_SOLVE_CATALOG)

  assert.equal(defaultCatalog, SIGMA_SOLVE_CATALOG)
  assert.equal(provider.source, 'sigmasolve')
  assert.equal(provider.companyName, 'Sigma Solve')
  assert.equal(provider.officialBrandName, 'Sigma Solve')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://www.sigmasolve.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sigmasolve.com/who-we-are/openings')
  assert.equal(provider.officialCareersPageUrl, 'https://www.sigmasolve.com/who-we-are/openings')
  assert.equal(provider.verifiedJobDetailUrl, 'https://www.sigmasolve.com/who-we-are/open-position/content-growth-strategist')
  assert.equal(provider.companyDomain, 'sigmasolve.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.verifiedSampleJobTitle, 'Content & Growth Strategist')
  assert.equal(provider.paginationStrategy, 'single-first-party-openings-page-plus-same-domain-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-openings-page+same-domain-opening-cards+same-domain-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sigmasolve[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /official openings page/i)
  assert.match(provider.verifiedSurfaceSummary, /same-domain detail page/i)
  assert.match(provider.verifiedSurfaceSummary, /live first-party application form for the same job slug/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sigma Solve'), false)

  assert.equal(sigmaSolve.PROVIDER_METADATA.source, SIGMA_SOLVE_CATALOG.source)
  assert.equal(sigmaSolve.PROVIDER_METADATA.verifiedJobDetailUrl, SIGMA_SOLVE_CATALOG.verifiedJobDetailUrl)
})

test('Sigma Solve exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { SIGMA_SOLVE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sigma Solve\n',
    catalog: [hydrateProviderCatalogEntry(SIGMA_SOLVE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sigma Solve', 'sigmasolve', 'Sigma Solve']],
  )
})

test('Sigma Solve hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SIGMA_SOLVE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIGMA_SOLVE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /sigmasolve[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sigmasolve[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
