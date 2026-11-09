import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/sepc/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sepc/catalog.js')
  } catch {
    assert.fail('Expected SEPC catalog module at ../../scraper/sepc/catalog.js')
  }
}

test('SEPC local catalog captures the verified empty official careers shell without alias churn', async () => {
  const { SEPC_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SEPC_CATALOG)

  assert.equal(defaultCatalog, SEPC_CATALOG)
  assert.equal(provider.source, 'sepc')
  assert.equal(provider.companyName, 'SEPC')
  assert.equal(provider.officialBrandName, 'SEPC Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.sepc.in/')
  assert.equal(provider.companyCareerPage, 'https://www.sepc.in/careers.aspx')
  assert.equal(provider.companyDomain, 'sepc.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-empty-current-openings-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-current-openings-shell+empty-fypdf-list-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /sepc[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sepc\.in\/careers\.aspx/i)
  assert.match(provider.verifiedSurfaceSummary, /CURRENT OPENINGS/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SEPC'), false)
})

test('SEPC exact backlog row matches directly from the local provider metadata', async () => {
  const { SEPC_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SEPC\n',
    catalog: [hydrateProviderCatalogEntry(SEPC_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SEPC', 'sepc', 'SEPC']],
  )
})

test('SEPC hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SEPC_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SEPC_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SEPC')
  assert.equal(provider.companyCareerPage, 'https://www.sepc.in/careers.aspx')
  assert.equal(provider.companyDomain, 'sepc.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /sepc[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sepc[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
