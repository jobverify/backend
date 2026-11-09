import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mahanagargas/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mahanagargas/catalog.js')
  } catch {
    assert.fail('Expected Mahanagar Gas catalog module at ../../scraper/mahanagargas/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mahanagargas/script.js')
  } catch {
    assert.fail('Expected Mahanagar Gas scraper module at ../../scraper/mahanagargas/script.js')
  }
}

test('Mahanagar Gas local catalog captures the verified reachable no-public-jobs first-party state without alias churn', async () => {
  const { MAHANAGAR_GAS_CATALOG } = await loadCatalogModule()
  const mahanagarGas = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MAHANAGAR_GAS_CATALOG)

  assert.equal(provider.source, 'mahanagargas')
  assert.equal(provider.companyName, 'Mahanagar Gas')
  assert.equal(provider.officialBrandName, 'Mahanagar Gas Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mahanagargas.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mahanagargas.com/')
  assert.equal(provider.companyDomain, 'mahanagargas.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-and-common-careers-route-official-shell-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-shells-no-public-job-signal-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.match(provider.dryRunFile, /mahanagargas[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mahanagargas\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /\bno trustworthy public jobs surface\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\breachable\b/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mahanagar Gas'), false)

  assert.equal(mahanagarGas.PROVIDER_METADATA.source, MAHANAGAR_GAS_CATALOG.source)
  assert.equal(mahanagarGas.PROVIDER_METADATA.companyName, MAHANAGAR_GAS_CATALOG.companyName)
  assert.equal(mahanagarGas.PROVIDER_METADATA.companyCareerPage, MAHANAGAR_GAS_CATALOG.companyCareerPage)
})

test('Mahanagar Gas backlog row matches directly from the local catalog without alias churn', async () => {
  const { MAHANAGAR_GAS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mahanagar Gas\n',
    catalog: [hydrateProviderCatalogEntry(MAHANAGAR_GAS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mahanagar Gas', 'mahanagargas', 'Mahanagar Gas']],
  )
})
