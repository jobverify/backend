import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/suzlonenergy/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/suzlonenergy/catalog.js')
  } catch {
    assert.fail('Expected Suzlon Energy catalog module at ../../scraper/suzlonenergy/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/suzlonenergy/script.js')
  } catch {
    assert.fail('Expected Suzlon Energy scraper module at ../../scraper/suzlonenergy/script.js')
  }
}

test('Suzlon Energy local catalog captures the verified first-party careers sentinel surface', async () => {
  const { SUZLON_ENERGY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const suzlonEnergy = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SUZLON_ENERGY_CATALOG)

  assert.equal(defaultCatalog, SUZLON_ENERGY_CATALOG)
  assert.equal(provider.source, 'suzlonenergy')
  assert.equal(provider.companyName, 'Suzlon Energy')
  assert.equal(provider.officialBrandName, 'Suzlon Energy Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.suzlon.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.suzlon.com/careers/')
  assert.equal(provider.companyDomain, 'suzlon.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+return-empty-when-no-trustworthy-public-jobs-surface',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.dryRunFile, /suzlonenergy[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.suzlon\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy enumerable public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Suzlon Energy'), false)

  assert.equal(suzlonEnergy.PROVIDER_METADATA.source, SUZLON_ENERGY_CATALOG.source)
  assert.equal(suzlonEnergy.PROVIDER_METADATA.companyName, SUZLON_ENERGY_CATALOG.companyName)
  assert.equal(
    suzlonEnergy.PROVIDER_METADATA.companyCareerPage,
    SUZLON_ENERGY_CATALOG.companyCareerPage,
  )
})

test('Suzlon Energy exact backlog row matches directly from local provider metadata', async () => {
  const { SUZLON_ENERGY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Suzlon Energy\n',
    catalog: [hydrateProviderCatalogEntry(SUZLON_ENERGY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Suzlon Energy', 'suzlonenergy', 'Suzlon Energy']],
  )
})

test('Suzlon Energy hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SUZLON_ENERGY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SUZLON_ENERGY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Suzlon Energy')
  assert.equal(provider.companyCareerPage, 'https://www.suzlon.com/careers/')
  assert.equal(provider.companyDomain, 'suzlon.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-trustworthy-public-jobs-surface')
  assert.match(provider.modulePath, /suzlonenergy[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /suzlonenergy[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
