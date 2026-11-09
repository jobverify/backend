import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/spiretechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/spiretechnologies/catalog.js')
  } catch {
    assert.fail('Expected Spire Technologies catalog module at ../../scraper/spiretechnologies/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/spiretechnologies/script.js')
  } catch {
    assert.fail('Expected Spire Technologies scraper module at ../../scraper/spiretechnologies/script.js')
  }
}

test('Spire Technologies local catalog captures the verified exact-name homepage sentinel without alias churn', async () => {
  const { SPIRE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const spire = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SPIRE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SPIRE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'spiretechnologies')
  assert.equal(provider.companyName, 'Spire Technologies')
  assert.equal(provider.officialBrandName, 'Spire Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://spiretechno.com/')
  assert.equal(provider.officialCareersPageUrl, 'https://spiretechno.com/')
  assert.equal(provider.companyDomain, 'spiretechno.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-official-homepage-no-public-careers-surface')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+no-public-careers-signal+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /spiretechnologies[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/spiretechno\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /support@spiretechnologies\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /www\.spiretechnologies\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Spire Technologies'), false)

  assert.equal(spire.PROVIDER_METADATA.source, SPIRE_TECHNOLOGIES_CATALOG.source)
  assert.equal(spire.PROVIDER_METADATA.companyName, SPIRE_TECHNOLOGIES_CATALOG.companyName)
})

test('Spire Technologies exact backlog row matches directly from the local provider metadata', async () => {
  const { SPIRE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Spire Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SPIRE_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Spire Technologies', 'spiretechnologies', 'Spire Technologies']],
  )
})

test('Spire Technologies hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SPIRE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SPIRE_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Spire Technologies')
  assert.equal(provider.companyCareerPage, 'https://spiretechno.com/')
  assert.equal(provider.companyDomain, 'spiretechno.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /spiretechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /spiretechnologies[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
