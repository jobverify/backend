import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const mammothModulePath = path.resolve(currentDir, '../../scraper/mammoth/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mammoth/catalog.js')
  } catch {
    assert.fail('Expected Mammoth catalog module at ../../scraper/mammoth/catalog.js')
  }
}

test('Mammoth local catalog captures the verified first-party no-public-jobs surface', async () => {
  const {
    MAMMOTH_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAMMOTH_CATALOG)

  assert.equal(defaultCatalog, MAMMOTH_CATALOG)
  assert.equal(provider.source, 'mammoth')
  assert.equal(provider.companyName, 'Mammoth')
  assert.equal(provider.officialBrandName, 'Mammoth Analytics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://mammoth.io/')
  assert.equal(provider.companyDomain, 'mammoth.io')
  assert.equal(provider.officialAboutUrl, 'https://mammoth.io/about-us/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-about-plus-common-careers-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-about-page+verified-missing-common-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mammoth\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mammoth\.io\/about-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(provider.modulePath, mammothModulePath)
  assert.match(provider.dryRunFile, /mammoth[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mammoth'), false)
})

test('Mammoth backlog row matches directly from the local catalog metadata', async () => {
  const { MAMMOTH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mammoth\n',
    catalog: [MAMMOTH_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mammoth', 'mammoth', 'Mammoth']],
  )
})
