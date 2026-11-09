import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const moneyviewModulePath = path.resolve(currentDir, '../../scraper/moneyview/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/moneyview/catalog.js')
  } catch {
    assert.fail('Expected Moneyview catalog module at ../../scraper/moneyview/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/moneyview/script.js')
  } catch {
    assert.fail('Expected Moneyview scraper module at ../../scraper/moneyview/script.js')
  }
}

test('Moneyview local catalog captures the verified first-party careers page and Darwinbox handoff', async () => {
  const { MONEYVIEW_CATALOG } = await loadCatalogModule()
  const moneyview = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MONEYVIEW_CATALOG)

  assert.equal(provider.source, 'moneyview')
  assert.equal(provider.companyName, 'Moneyview')
  assert.equal(provider.officialBrandName, 'Moneyview')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://moneyview.in/careers')
  assert.equal(provider.companyDomain, 'moneyview.in')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+darwinbox-candidate-handoff+darwinbox-listing-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://moneyview.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://moneyview.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /moneyview[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, moneyviewModulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moneyview\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /career@moneyview\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/moneyview\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Moneyview'), false)

  assert.equal(moneyview.PROVIDER_METADATA.source, MONEYVIEW_CATALOG.source)
  assert.equal(moneyview.PROVIDER_METADATA.companyName, MONEYVIEW_CATALOG.companyName)
  assert.equal(
    moneyview.PROVIDER_METADATA.officialCareersHandoffUrl,
    MONEYVIEW_CATALOG.officialCareersHandoffUrl,
  )
})

test('Moneyview backlog row matches directly from the local catalog without alias churn', async () => {
  const { MONEYVIEW_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Moneyview\n',
    catalog: [hydrateProviderCatalogEntry(MONEYVIEW_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Moneyview', 'moneyview', 'Moneyview']],
  )
})
