import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/accubitstechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/accubitstechnologies/catalog.js')
  } catch {
    assert.fail('Expected Accubits Technologies catalog module at ../../scraper/accubitstechnologies/catalog.js')
  }
}

test('Accubits Technologies local catalog captures the verified generic careers shell with no trustworthy public jobs feed', async () => {
  const { ACCUBITS_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ACCUBITS_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, ACCUBITS_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'accubitstechnologies')
  assert.equal(provider.companyName, 'Accubits Technologies')
  assert.equal(provider.officialBrandName, 'Accubits')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://accubits.com/career/')
  assert.equal(provider.officialCareersPageUrl, 'https://accubits.com/career/')
  assert.equal(provider.companyDomain, 'accubits.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-page')
  assert.equal(provider.extractionStrategy, 'verified-careers-shell+search-controls-without-public-listings-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /accubitstechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Latest Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Accubits Technologies'), false)
})

test('Accubits Technologies exact backlog row matches from the local catalog entry', async () => {
  const { ACCUBITS_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Accubits Technologies\n',
    catalog: [hydrateProviderCatalogEntry(ACCUBITS_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Accubits Technologies', 'accubitstechnologies', 'Accubits Technologies']],
  )
})

test('Accubits Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { ACCUBITS_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ACCUBITS_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://accubits.com/career/')
  assert.equal(provider.companyDomain, 'accubits.com')
  assert.match(provider.modulePath, /accubitstechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
