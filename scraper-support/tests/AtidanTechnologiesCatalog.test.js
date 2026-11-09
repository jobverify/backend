import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/atidantechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/atidantechnologies/catalog.js')
  } catch {
    assert.fail('Expected Atidan Technologies catalog module at ../../scraper/atidantechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/atidantechnologies/script.js')
  } catch {
    assert.fail('Expected Atidan Technologies scraper module at ../../scraper/atidantechnologies/script.js')
  }
}

test('Atidan Technologies local catalog captures the verified first-party WordPress careers archive', async () => {
  const { ATIDAN_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const atidan = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ATIDAN_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, ATIDAN_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'atidantechnologies')
  assert.equal(provider.companyName, 'Atidan Technologies')
  assert.equal(provider.officialBrandName, 'Atidan Technologies Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://atidantech.com/careers/')
  assert.equal(provider.companyDomain, 'atidantech.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-posts')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-archive-plus-linked-role-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-archive+verified-role-detail-pages+remote-role-normalization',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /atidantechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /SCCM L3 Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /ServiceNow HRSD Developer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Atidan Technologies'), false)

  assert.equal(atidan.PROVIDER_METADATA.source, ATIDAN_TECHNOLOGIES_CATALOG.source)
  assert.equal(atidan.PROVIDER_METADATA.companyCareerPage, ATIDAN_TECHNOLOGIES_CATALOG.companyCareerPage)
})

test('Atidan Technologies exact backlog row resolves from the local provider contract', async () => {
  const { ATIDAN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Atidan Technologies\n',
    catalog: [hydrateProviderCatalogEntry(ATIDAN_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Atidan Technologies', 'atidantechnologies', 'Atidan Technologies']],
  )
})
