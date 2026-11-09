import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rapido/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rapido/catalog.js')
  } catch {
    assert.fail('Expected Rapido catalog module at ../../scraper/rapido/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/rapido/script.js')
  } catch {
    assert.fail('Expected Rapido scraper module at ../../scraper/rapido/script.js')
  }
}

test('Rapido local catalog captures the verified first-party careers page and Darwinbox handoff', async () => {
  const { RAPIDO_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rapido = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(RAPIDO_CATALOG)

  assert.equal(defaultCatalog, RAPIDO_CATALOG)
  assert.equal(provider.source, 'rapido')
  assert.equal(provider.companyName, 'Rapido')
  assert.equal(provider.officialBrandName, 'Rapido')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.rapido.bike/Careers')
  assert.equal(provider.officialCareersPageUrl, 'https://www.rapido.bike/Careers')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://rapido.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://rapido.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.companyDomain, 'rapido.bike')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(provider.extractionStrategy, 'official-careers-page+darwinbox-listing-api')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /rapido[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rapido\.bike\/Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/rapido\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /View Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rapido'), false)

  assert.equal(rapido.PROVIDER_METADATA.source, RAPIDO_CATALOG.source)
  assert.equal(rapido.PROVIDER_METADATA.companyName, RAPIDO_CATALOG.companyName)
})

test('Rapido exact backlog row matches directly from local provider metadata', async () => {
  const { RAPIDO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rapido\n',
    catalog: [hydrateProviderCatalogEntry(RAPIDO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rapido', 'rapido', 'Rapido']],
  )
})

test('Rapido hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { RAPIDO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAPIDO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rapido')
  assert.equal(provider.companyCareerPage, 'https://www.rapido.bike/Careers')
  assert.equal(provider.companyDomain, 'rapido.bike')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(provider.modulePath, /rapido[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /rapido[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
