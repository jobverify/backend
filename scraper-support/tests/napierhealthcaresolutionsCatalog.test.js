import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/napierhealthcaresolutions/script.js')

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/napierhealthcaresolutions/provider.js')
  } catch {
    assert.fail('Expected Napier Healthcare Solutions provider module at ../../scraper/napierhealthcaresolutions/provider.js')
  }
}

test('Napier local provider metadata captures the unavailable September 13, 2026 careers route', async () => {
  const { provider, default: defaultProvider } = await loadProviderModule()
  const hydrated = hydrateProviderCatalogEntry(provider)

  assert.equal(defaultProvider, provider)
  assert.equal(hydrated.source, 'napierhealthcaresolutions')
  assert.equal(hydrated.companyName, 'Napier Healthcare Solutions')
  assert.equal(hydrated.officialBrandName, 'Napier')
  assert.equal(hydrated.adapter, 'script')
  assert.equal(hydrated.homepageUrl, 'http://www.napierhealthcare.com/v2/')
  assert.equal(hydrated.companyCareerPage, 'http://www.napierhealthcare.com/v2/careers/')
  assert.equal(hydrated.companyDomain, 'napierhealthcare.com')
  assert.equal(hydrated.atsPlatform, 'official-company-careers-unavailable')
  assert.equal(hydrated.countryFilter, 'India')
  assert.equal(hydrated.paginationStrategy, 'single-first-party-careers-route-unavailable-validation')
  assert.equal(
    hydrated.extractionStrategy,
    'verified-unavailable-first-party-careers-route+typed-upstream-failure',
  )
  assert.equal(hydrated.parser, 'custom-script')
  assert.equal(hydrated.normalizationProfile, 'engineering-default')
  assert.equal(hydrated.verifiedOn, '2026-09-13')
  assert.equal(hydrated.modulePath, modulePath)
  assert.match(hydrated.dryRunFile, /napierhealthcaresolutions[\\/]jobs\.json$/i)
  assert.match(hydrated.verifiedSurfaceSummary, /Sunday, September 13, 2026/i)
  assert.match(hydrated.verifiedSurfaceSummary, /http:\/\/www\.napierhealthcare\.com\/v2\/careers\//i)
  assert.match(hydrated.verifiedSurfaceSummary, /HTTP 404/i)
  assert.match(hydrated.verifiedSurfaceSummary, /thetransformationhub\.com\.au/i)
})

test('Napier exact backlog row resolves directly from local provider metadata', async () => {
  const { provider } = await loadProviderModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Napier Healthcare Solutions\n',
    catalog: [hydrateProviderCatalogEntry(provider)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Napier Healthcare Solutions', 'napierhealthcaresolutions', 'Napier Healthcare Solutions']],
  )
})

test('Napier hydrated local provider stays script-runner compatible for central registry integration', async () => {
  const { provider } = await loadProviderModule()
  const hydrated = hydrateProviderCatalogEntry(provider)
  const module = await import(pathToFileURL(hydrated.modulePath).href)

  assert.equal(hydrated.adapter, 'script')
  assert.equal(hydrated.companyName, 'Napier Healthcare Solutions')
  assert.equal(hydrated.companyCareerPage, 'http://www.napierhealthcare.com/v2/careers/')
  assert.equal(hydrated.companyDomain, 'napierhealthcare.com')
  assert.match(hydrated.modulePath, /napierhealthcaresolutions[\\/]script\.js$/i)
  assert.match(hydrated.dryRunFile, /napierhealthcaresolutions[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
