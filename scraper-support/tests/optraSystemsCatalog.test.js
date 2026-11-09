import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/optrasystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/optrasystems/catalog.js')
  } catch {
    assert.fail('Expected Optra Systems catalog module at ../../scraper/optrasystems/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/optrasystems/script.js')
  } catch {
    assert.fail('Expected Optra Systems scraper module at ../../scraper/optrasystems/script.js')
  }
}

test('Optra Systems local catalog captures the exact-name unresolved-domain no-public-jobs contract', async () => {
  const { OPTRA_SYSTEMS_CATALOG } = await loadCatalogModule()
  const optraSystems = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(OPTRA_SYSTEMS_CATALOG)

  assert.equal(provider.source, 'optrasystems')
  assert.equal(provider.companyName, 'Optra Systems')
  assert.equal(provider.officialBrandName, 'Optra Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://optrasystems.com/')
  assert.equal(provider.exactNamePrimaryDomainUrl, 'https://optrasystems.com/')
  assert.equal(provider.exactNameWwwDomainUrl, 'https://www.optrasystems.com/')
  assert.equal(provider.officialPortfolioReferenceUrl, 'https://www.optraventures.com/')
  assert.equal(provider.companyDomain, 'optrasystems.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'exact-name-domain-resolution-check-plus-official-portfolio-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-portfolio-reference+unresolved-exact-name-domain-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /optrasystems[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/optrasystems\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.optraventures\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Optra Systems'), false)

  assert.equal(optraSystems.PROVIDER_METADATA.source, OPTRA_SYSTEMS_CATALOG.source)
  assert.equal(optraSystems.PROVIDER_METADATA.companyName, OPTRA_SYSTEMS_CATALOG.companyName)
  assert.equal(
    optraSystems.PROVIDER_METADATA.officialPortfolioReferenceUrl,
    OPTRA_SYSTEMS_CATALOG.officialPortfolioReferenceUrl,
  )
})

test('Optra Systems exact backlog row resolves directly from local provider metadata', async () => {
  const { OPTRA_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Optra Systems\n',
    catalog: [hydrateProviderCatalogEntry(OPTRA_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Optra Systems', 'optrasystems', 'Optra Systems']],
  )
})

test('getScraperCatalog exposes Optra Systems as a runnable shared provider without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'optrasystems')
  const scraper = buildScrapers().find((item) => item.name === 'optrasystems')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Optra Systems')
  assert.equal(provider.companyCareerPage, 'https://optrasystems.com/')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Optra Systems'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Optra Systems\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Optra Systems', 'optrasystems', 'Optra Systems']],
  )
})

test('Optra Systems hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { OPTRA_SYSTEMS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(OPTRA_SYSTEMS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /optrasystems[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /optrasystems[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
